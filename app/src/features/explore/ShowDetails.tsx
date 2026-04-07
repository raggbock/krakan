import React, { useEffect, useMemo, useState } from 'react'
import { RouteProp, useNavigation } from '@react-navigation/core'
import { Alert, Pressable, TextInput, View } from 'react-native'
import { useSelector } from 'react-redux'
import styled, { useTheme } from 'styled-components/native'

import * as api from '../../api'
import { SCREEN_NAMES } from '../../app/constants'
import { useAppDispatch } from '../../app/store'
import GoBack from '../../components/GoBack/GoBack'
import { Spinner } from '../../components'
import { Card, Image, Page, Text } from '../../Generics'
import { formatDateTime } from '../../utils/dateUtils'
import { getFormattedCurrency } from '../../utils/localeUtils'
import { COLORS, rgba } from '../../utils/colorUtils'
import { contextSelector } from '../context/contextSelectors'
import useTranslation from '../locale/useTranslation'
import { requestGetShows, requestShowDetails } from '../shows/showsSlice'
import { showDetailsSelector } from '../shows/showsSelectors'

type ShowDetailsRoute = RouteProp<{
  ShowDetails: {
    id: string
    suggestedBandId?: string
    suggestedBandName?: string
    inquiryId?: string
    inquiryStatus?: string
  }
}, 'ShowDetails'>

type Ticket = {
  id: string
  name?: string
  price?: {
    amount?: number
    currency?: string
  } | string | number
  priceCurrency?: string
  priceAmount?: number
  currency?: string
  quantity?: number
  ticketsLeft?: number
  reusable?: boolean
}

type Slot = {
  id: string
  bandId?: string | null
  bandName?: string | null
  hasBand?: boolean
  dateFrom?: string
  timeTo?: string
}

type ShowDetail = {
  id?: string
  name?: string
  description?: string
  date?: string
  soldOut?: boolean
  isPublished?: boolean
  publishedAt?: string | null
  venue?: {
    id?: string
    name?: string
  }
  imageUrl?: string
  imageUrls?: string[]
  tickets?: Ticket[]
  slots?: Slot[]
}

const Hero = styled.View`
  height: 260px;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
`

const Section = styled(Card)`
  margin-bottom: 12px;
`

const TicketRow = styled(Card)`
  margin-top: 12px;
`

const ManagementInput = styled(TextInput)`
  width: 100%;
  min-height: 48px;
  border-radius: 14px;
  padding: 12px 14px;
  margin-top: 10px;
`

const StatusPill = styled.View`
  padding: 8px 12px;
  border-radius: 999px;
  align-self: flex-start;
`

const TimelineRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 12px;
`

const TimelineStep = styled.View`
  flex-direction: row;
  align-items: center;
  margin-right: 12px;
  margin-bottom: 10px;
`

const TimelineDot = styled.View`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 8px;
`

function getTicketPrice(ticket: Ticket): { amount: number; currency: string } {
  const amount =
    typeof ticket.price === 'object'
      ? ticket.price?.amount ?? ticket.priceAmount ?? 0
      : Number(ticket.price ?? ticket.priceAmount ?? 0)

  const currency =
    (typeof ticket.price === 'object' ? ticket.price?.currency : ticket.currency) ??
    ticket.priceCurrency ??
    'SEK'

  return { amount, currency }
}

export default function ShowDetails({ route }: { route: ShowDetailsRoute }) {
  const { id, suggestedBandId, suggestedBandName, inquiryId, inquiryStatus } = route.params
  const navigation = useNavigation<any>()
  const dispatch = useAppDispatch()
  const translate = useTranslation()
  const theme = useTheme()
  const { contextDetails } = useSelector(contextSelector)
  const { details, isLoading } = useSelector(showDetailsSelector) as {
    details: ShowDetail
    isLoading: boolean
  }

  const [ticketName, setTicketName] = useState('')
  const [ticketPrice, setTicketPrice] = useState('')
  const [ticketAmount, setTicketAmount] = useState('')
  const [isReusable, setIsReusable] = useState(false)
  const [isSavingTicket, setIsSavingTicket] = useState(false)
  const [isUpdatingPublication, setIsUpdatingPublication] = useState(false)
  const [slotStartTime, setSlotStartTime] = useState('19:00')
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('45')
  const [isSavingSlot, setIsSavingSlot] = useState(false)
  const [bookingFlowStatus, setBookingFlowStatus] = useState(inquiryStatus ?? 'accepted')

  useEffect(() => {
    if (id) {
      dispatch(requestShowDetails(id))
    }
  }, [dispatch, id])

  const { day, date } = formatDateTime(details?.date, true)
  const imageUri = details?.imageUrl ?? details?.imageUrls?.[0]
  const venueIds = useMemo(
    () => (contextDetails?.venues ?? []).map((venue: { id: string }) => venue.id),
    [contextDetails?.venues],
  )
  const isVenueOwner = !!details?.venue?.id && venueIds.includes(details.venue.id)
  const slots = details?.slots ?? []

  const onCheckout = (ticket: Ticket) => {
    const { amount, currency } = getTicketPrice(ticket)

    navigation.navigate(SCREEN_NAMES.CHECKOUT, {
      showId: id,
      showName: details?.name ?? 'Show',
      showDate: details?.date,
      venueName: details?.venue?.name ?? '',
      ticket: {
        id: ticket.id,
        name: ticket.name ?? 'Biljett',
        quantity: ticket.quantity ?? 1,
        price: amount,
        currency,
      },
    })
  }

  async function reloadShow() {
    await dispatch(requestShowDetails(id))
    await dispatch(requestGetShows())
  }

  async function handlePublication(isPublished: boolean) {
    if (!details?.venue?.id) return

    try {
      setIsUpdatingPublication(true)
      await api.shows.put.publication(
        { isPublished },
        { venueId: details.venue.id, showId: id },
      )
      await reloadShow()
      Alert.alert(
        translate('show.management.savedTitle'),
        isPublished
          ? translate('show.management.publishSuccess')
          : translate('show.management.unpublishSuccess'),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate('show.management.error')
      Alert.alert(translate('show.management.errorTitle'), message)
    } finally {
      setIsUpdatingPublication(false)
    }
  }

  async function handleCreateTicket() {
    if (!ticketName.trim() || !ticketPrice.trim() || !ticketAmount.trim()) {
      Alert.alert(
        translate('show.management.errorTitle'),
        translate('show.management.ticketValidation'),
      )
      return
    }

    try {
      setIsSavingTicket(true)
      await api.shows.post.createTicket(
        {
          name: ticketName.trim(),
          reusable: isReusable,
          amount: Number(ticketAmount),
          price: {
            amount: Number(ticketPrice),
            currency: 'SEK',
          },
        },
        { showId: id },
      )
      setTicketName('')
      setTicketPrice('')
      setTicketAmount('')
      setIsReusable(false)
      await reloadShow()
      Alert.alert(
        translate('show.management.savedTitle'),
        translate('show.management.ticketSuccess'),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate('show.management.error')
      Alert.alert(translate('show.management.errorTitle'), message)
    } finally {
      setIsSavingTicket(false)
    }
  }

  function buildSlotInterval(durationMinutes: string) {
    const minutes = Math.max(15, Number(durationMinutes) || 0)
    return `${Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:00`
  }

  function buildSlotDate(dateValue?: string, startTime = '19:00') {
    const baseDate = dateValue ? new Date(dateValue) : new Date()
    const [hours, minutes] = startTime.split(':').map((value) => Number(value) || 0)
    baseDate.setHours(hours, minutes, 0, 0)
    return baseDate.toISOString()
  }

  async function handleCreateSuggestedSlot() {
    if (!details?.venue?.id || !suggestedBandId) {
      return
    }

    try {
      setIsSavingSlot(true)
      await api.shows.post.addSlot(
        {
          bandId: suggestedBandId,
          slot: {
            bandId: suggestedBandId,
            date: buildSlotDate(details?.date, slotStartTime),
            interval: buildSlotInterval(slotDurationMinutes),
          },
        },
        { venueId: details.venue.id, showId: id },
      )
      if (inquiryId) {
        await api.matchmaking.put.status(
          { status: 'slotProposed' },
          { inquiryId },
        )
        setBookingFlowStatus('slotProposed')
      }
      await reloadShow()
      Alert.alert(
        translate('show.management.savedTitle'),
        translate('show.management.slotSuccess', { bandName: suggestedBandName ?? 'band' }),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate('show.management.error')
      Alert.alert(translate('show.management.errorTitle'), message)
    } finally {
      setIsSavingSlot(false)
    }
  }

  const bookingTimeline = useMemo(() => {
    const currentIndex =
      bookingFlowStatus === 'slotProposed'
        ? 2
        : bookingFlowStatus === 'booked'
          ? 3
          : suggestedBandId
            ? 1
            : -1

    return [
      {
        key: 'inquirySent',
        label: translate('inbox.timeline.inquirySent'),
        complete: currentIndex >= 0,
      },
      {
        key: 'accepted',
        label: translate('inbox.timeline.accepted'),
        complete: currentIndex >= 1,
      },
      {
        key: 'slotProposed',
        label: translate('inbox.timeline.slotProposed'),
        complete: currentIndex >= 2,
      },
      {
        key: 'booked',
        label: translate('inbox.timeline.booked'),
        complete: currentIndex >= 3,
      },
    ]
  }, [bookingFlowStatus, suggestedBandId, translate])

  return (
    <Page safe>
      <GoBack background={false} />
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {!!imageUri && (
            <Hero>
              <Image uri={imageUri} />
            </Hero>
          )}
          <Section size="m">
            <Text header bold size="large">
              {details?.name ?? 'Show'}
            </Text>
            <StatusPill
              style={{
                marginTop: 10,
                backgroundColor: details?.isPublished
                  ? rgba(COLORS.turquoise, 0.16)
                  : rgba(COLORS.black, 0.06),
              }}
            >
              <Text
                bold
                size="small"
                color={details?.isPublished ? COLORS.turquoise : theme.text.primary}
              >
                {details?.isPublished
                  ? translate('show.management.published')
                  : translate('show.management.draft')}
              </Text>
            </StatusPill>
            {!!details?.venue?.name && (
              <Text style={{ marginTop: 8 }}>{details.venue.name}</Text>
            )}
            {!!details?.date && (
              <Text style={{ marginTop: 6 }}>
                {[day, date].filter(Boolean).join(' ')}
              </Text>
            )}
            {details?.soldOut ? (
              <Text color="#D94B4B" style={{ marginTop: 8 }}>
                SOLD OUT
              </Text>
            ) : null}
          </Section>

          <Section size="m">
            <Text header bold>
              {translate('show.about')}
            </Text>
            <Text style={{ marginTop: 8 }}>
              {details?.description ?? 'Ingen beskrivning tillganglig an.'}
            </Text>
            {!!suggestedBandId && (
              <TimelineRow>
                {bookingTimeline.map((step) => (
                  <TimelineStep key={step.key}>
                    <TimelineDot
                      style={{
                        backgroundColor: step.complete
                          ? COLORS.turquoise
                          : rgba(COLORS.black, 0.14),
                      }}
                    />
                    <Text size="small" color={step.complete ? theme.text.primary : theme.text.tertiary}>
                      {step.label}
                    </Text>
                  </TimelineStep>
                ))}
              </TimelineRow>
            )}
          </Section>

          {!!slots.length && (
            <Section size="m">
              <Text header bold>
                {translate('show.management.lineup')}
              </Text>
              {slots.map((slot) => (
                <TicketRow key={slot.id} size="s">
                  <Text bold>
                    {slot.bandName ?? translate('show.management.openSlot')}
                  </Text>
                  {!!slot.dateFrom && (
                    <Text style={{ marginTop: 4 }}>
                      {formatDateTime(slot.dateFrom)}
                    </Text>
                  )}
                </TicketRow>
              ))}
            </Section>
          )}

          {!!details?.tickets?.length && (
            <Section size="m">
              <Text header bold>
                Tickets
              </Text>
              {details.tickets.map((ticket) => {
                const { amount, currency } = getTicketPrice(ticket)

                return (
                  <TicketRow key={ticket.id} size="s">
                    <Text bold>{ticket.name ?? 'Biljett'}</Text>
                    <Text style={{ marginTop: 4 }}>
                      {getFormattedCurrency(amount, currency, true)}
                    </Text>
                    {typeof ticket.ticketsLeft === 'number' && (
                      <Text style={{ marginTop: 4 }}>
                        {translate('show.management.ticketsLeft', {
                          amount: ticket.ticketsLeft,
                        })}
                      </Text>
                    )}
                    <View style={{ marginTop: 10 }}>
                      <Pressable onPress={() => onCheckout(ticket)}>
                        <Text bold color={COLORS.amazingBlue}>
                          {translate('show.buyTicket')}
                        </Text>
                      </Pressable>
                    </View>
                  </TicketRow>
                )
              })}
            </Section>
          )}

          {!details?.tickets?.length && (
            <Card size="m">
              <Text>{translate('show.noTickets')}</Text>
            </Card>
          )}

          {isVenueOwner && (
            <Section size="m">
              <Text header bold>
                {translate('show.management.title')}
              </Text>
              <Text style={{ marginTop: 8 }}>
                {translate('show.management.description')}
              </Text>
              <View style={{ marginTop: 12 }}>
                <Pressable onPress={() => handlePublication(!details?.isPublished)}>
                  <Text bold color={COLORS.amazingBlue}>
                    {isUpdatingPublication
                      ? translate('show.management.saving')
                      : details?.isPublished
                        ? translate('show.management.unpublish')
                        : translate('show.management.publish')}
                  </Text>
                </Pressable>
              </View>

              <Text header bold style={{ marginTop: 18 }}>
                {translate('show.management.ticketTitle')}
              </Text>
              <ManagementInput
                value={ticketName}
                onChangeText={setTicketName}
                placeholder={translate('show.management.ticketName')}
                placeholderTextColor={theme.text.tertiary}
                style={{
                  backgroundColor: theme.boxBackgrounds.tertiary,
                  color: theme.text.primary,
                }}
              />
              <ManagementInput
                value={ticketPrice}
                onChangeText={setTicketPrice}
                placeholder={translate('show.management.ticketPrice')}
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
                style={{
                  backgroundColor: theme.boxBackgrounds.tertiary,
                  color: theme.text.primary,
                }}
              />
              <ManagementInput
                value={ticketAmount}
                onChangeText={setTicketAmount}
                placeholder={translate('show.management.ticketAmount')}
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
                style={{
                  backgroundColor: theme.boxBackgrounds.tertiary,
                  color: theme.text.primary,
                }}
              />
              <View style={{ marginTop: 12 }}>
                <Pressable onPress={() => setIsReusable((current) => !current)}>
                  <Text bold color={isReusable ? COLORS.turquoise : theme.text.primary}>
                    {isReusable
                      ? translate('show.management.reusableOn')
                      : translate('show.management.reusableOff')}
                  </Text>
                </Pressable>
              </View>
              <View style={{ marginTop: 12 }}>
                <Pressable onPress={handleCreateTicket}>
                  <Text bold color={COLORS.amazingBlue}>
                    {isSavingTicket
                      ? translate('show.management.saving')
                      : translate('show.management.createTicket')}
                  </Text>
                </Pressable>
              </View>

              {!!suggestedBandId && (
                <>
                  <Text header bold style={{ marginTop: 18 }}>
                    {translate('show.management.slotTitle')}
                  </Text>
                  <Text style={{ marginTop: 8 }}>
                    {translate('show.management.slotDescription', {
                      bandName: suggestedBandName ?? 'Band',
                    })}
                  </Text>
                  <ManagementInput
                    value={slotStartTime}
                    onChangeText={setSlotStartTime}
                    placeholder={translate('show.management.slotStartTime')}
                    placeholderTextColor={theme.text.tertiary}
                    style={{
                      backgroundColor: theme.boxBackgrounds.tertiary,
                      color: theme.text.primary,
                    }}
                  />
                  <ManagementInput
                    value={slotDurationMinutes}
                    onChangeText={setSlotDurationMinutes}
                    placeholder={translate('show.management.slotDuration')}
                    placeholderTextColor={theme.text.tertiary}
                    keyboardType="numeric"
                    style={{
                      backgroundColor: theme.boxBackgrounds.tertiary,
                      color: theme.text.primary,
                    }}
                  />
                  <View style={{ marginTop: 12 }}>
                    <Pressable onPress={handleCreateSuggestedSlot}>
                      <Text bold color={COLORS.gold}>
                        {isSavingSlot
                          ? translate('show.management.saving')
                          : translate('show.management.createSlotProposal', {
                              bandName: suggestedBandName ?? 'Band',
                            })}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Section>
          )}
        </>
      )}
    </Page>
  )
}
