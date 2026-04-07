import React, { useEffect } from 'react'
import { ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components/native'

import { Page, Text } from '../../Generics'
import GoBack from '../../components/GoBack/GoBack'
import Spinner from '../../components/Spinner/Spinner'
import {
  selectFleaMarketDetails,
  selectIsFetchingFleaMarketDetails,
} from '../../features/fleaMarkets/fleaMarketsSelectors'
import {
  requestGetFleaMarketDetails,
  clearSelectedDetails,
} from '../../features/fleaMarkets/fleaMarketsSlice'

const Header = styled.View`
  padding: 16px;
`

const Section = styled.View`
  padding: 16px;
`

const Badge = styled.View`
  background-color: ${(props) => props.theme.colors.primary};
  padding: 4px 12px;
  border-radius: 12px;
  align-self: flex-start;
  margin-top: 8px;
`

export default function FleaMarketDetails({ route }) {
  const dispatch = useDispatch()
  const details = useSelector(selectFleaMarketDetails)
  const isFetching = useSelector(selectIsFetchingFleaMarketDetails)

  const { fleaMarketId } = route.params

  useEffect(() => {
    dispatch(requestGetFleaMarketDetails(fleaMarketId))
    return () => {
      dispatch(clearSelectedDetails())
    }
  }, [fleaMarketId])

  if (isFetching || !details) {
    return (
      <Page>
        <GoBack />
        <Spinner />
      </Page>
    )
  }

  return (
    <Page>
      <GoBack />
      <ScrollView>
        <Header>
          <Text size="xlarge" bold>
            {details.name}
          </Text>
          <Badge>
            <Text size="small" color="white">
              {details.isPermanent ? 'Permanent' : 'Tillfällig'}
            </Text>
          </Badge>
        </Header>

        <Section>
          <Text>{details.description}</Text>
        </Section>

        <Section>
          <Text size="large" bold>
            Adress
          </Text>
          <Text>
            {details.street}, {details.zipCode} {details.city}
          </Text>
        </Section>

        {details.openingHours?.length > 0 && (
          <Section>
            <Text size="large" bold>
              Öppettider
            </Text>
            {details.openingHours.map((oh, i) => (
              <Text key={i}>
                {oh.dayOfWeek != null
                  ? `${getDayName(oh.dayOfWeek)}: `
                  : `${oh.date}: `}
                {oh.openTime} - {oh.closeTime}
              </Text>
            ))}
          </Section>
        )}
      </ScrollView>
    </Page>
  )
}

function getDayName(day: number): string {
  const days = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ]
  return days[day] ?? ''
}
