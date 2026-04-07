import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import styled, { useTheme } from 'styled-components/native'

import * as api from '../../api'
import { SCREEN_NAMES } from '../../app/constants'
import { Image, Page, Text } from '../../Generics'
import Icon from '../../components/Icon/Icon'
import { COLORS, rgba } from '../../utils/colorUtils'
import { formatDateTime } from '../../utils/dateUtils'
import useTranslation from '../../features/locale/useTranslation'

const SearchBar = styled.View`
  flex-direction: row;
  align-items: center;
  border-radius: 18px;
  padding: 0 16px;
  margin-top: 12px;
  min-height: 52px;
`

const SearchInput = styled(TextInput)`
  flex: 1;
  font-size: 16px;
  padding: 14px 12px;
`

const GenreScroll = styled(ScrollView)`
  margin-top: 14px;
  max-height: 44px;
`

const GenreChip = styled(Pressable)`
  padding: 10px 16px;
  border-radius: 999px;
  margin-right: 8px;
`

const Section = styled.View`
  margin-top: 24px;
`

const SectionTitle = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

const ResultCard = styled(Pressable)`
  flex-direction: row;
  padding: 14px;
  border-radius: 18px;
  margin-bottom: 10px;
`

const ResultImage = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  margin-right: 14px;
`

const PlaceholderImage = styled.View`
  width: 56px;
  height: 56px;
  border-radius: 14px;
  margin-right: 14px;
  align-items: center;
  justify-content: center;
`

const ResultInfo = styled.View`
  flex: 1;
  justify-content: center;
`

const GENRES = [
  'Rock',
  'Indie',
  'Pop',
  'Electronic',
  'Jazz',
  'Folk',
  'Hip-hop',
  'Punk',
  'Funk',
  'R&B',
  'Metal',
  'Blues',
  'Soul',
  'Classical',
]

type SearchResults = {
  bands: any[]
  venues: any[]
  shows: any[]
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const Search = () => {
  const navigation = useNavigation<any>()
  const theme = useTheme()
  const translate = useTranslation()

  const [query, setQuery] = useState('')
  const [activeGenre, setActiveGenre] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResults>({ bands: [], venues: [], shows: [] })
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string, genre: string | null) => {
    if (!searchQuery.trim() && !genre) {
      setResults({ bands: [], venues: [], shows: [] })
      setHasSearched(false)
      return
    }

    try {
      const params: Record<string, string> = {}
      if (searchQuery.trim()) params.query = searchQuery.trim()
      if (genre) params.genre = genre

      const { data } = await api.search.get.search(params)
      setResults({
        bands: data?.bands ?? [],
        venues: data?.venues ?? [],
        shows: data?.shows ?? [],
      })
      setHasSearched(true)
    } catch (_error) {
      setResults({ bands: [], venues: [], shows: [] })
      setHasSearched(true)
    }
  }, [])

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      performSearch(query, activeGenre)
    }, 400)

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  }, [query, activeGenre, performSearch])

  const handleGenrePress = (genre: string) => {
    setActiveGenre(activeGenre === genre ? null : genre)
  }

  const handleShowPress = (id: string) => {
    navigation.navigate(SCREEN_NAMES.TABS.EXPLORE, {
      screen: SCREEN_NAMES.SHOW_DETAILS,
      params: { id },
    })
  }

  const handleBandPress = (id: string) => {
    navigation.navigate(SCREEN_NAMES.TABS.EXPLORE, {
      screen: SCREEN_NAMES.BAND_DETAILS,
      params: { id },
    })
  }

  const handleVenuePress = (id: string) => {
    navigation.navigate(SCREEN_NAMES.TABS.EXPLORE, {
      screen: SCREEN_NAMES.VENUE_DETAILS,
      params: { id },
    })
  }

  const totalResults = results.bands.length + results.venues.length + results.shows.length
  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  return (
    <Page safe>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text header size="small" bold color={COLORS.amazingBlue}>
          Search
        </Text>
        <Text header size="huge" style={{ marginTop: 8 }}>
          Find your sound
        </Text>

        <SearchBar
          style={{
            backgroundColor: theme.boxBackgrounds.primary,
            borderWidth: 1,
            borderColor: rgba(COLORS.black, 0.08),
          }}
        >
          <Icon name="search" size={20} color={theme.text.tertiary} />
          <SearchInput
            value={query}
            onChangeText={setQuery}
            placeholder="Shows, bands, venues..."
            placeholderTextColor={theme.text.tertiary}
            style={{ color: theme.text.primary }}
            returnKeyType="search"
          />
          {!!(query || activeGenre) && (
            <Pressable
              onPress={() => {
                setQuery('')
                setActiveGenre(null)
              }}
            >
              <Text size="small" bold color={theme.text.tertiary}>
                Clear
              </Text>
            </Pressable>
          )}
        </SearchBar>

        <GenreScroll
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {GENRES.map((genre) => {
            const isActive = activeGenre === genre
            return (
              <GenreChip
                key={genre}
                onPress={() => handleGenrePress(genre)}
                style={{
                  backgroundColor: isActive
                    ? COLORS.amazingBlue
                    : rgba(COLORS.black, 0.05),
                }}
              >
                <Text
                  size="small"
                  bold
                  color={isActive ? COLORS.white : theme.text.primary}
                >
                  {genre}
                </Text>
              </GenreChip>
            )
          })}
        </GenreScroll>

        {hasSearched && totalResults === 0 && (
          <View
            style={{
              marginTop: 40,
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
          >
            <Text header size="large" center>
              No results
            </Text>
            <Text
              size="small"
              color={theme.text.tertiary}
              center
              style={{ marginTop: 8 }}
            >
              {`Try a different search or genre`}
            </Text>
          </View>
        )}

        {!!results.bands.length && (
          <Section>
            <SectionTitle>
              <Text header size="increased">
                Bands
              </Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: rgba(COLORS.amazingBlue, 0.1),
                }}
              >
                <Text size="small" bold color={COLORS.amazingBlue}>
                  {String(results.bands.length)}
                </Text>
              </View>
            </SectionTitle>
            {results.bands.map((band) => (
              <ResultCard
                key={band.id}
                onPress={() => handleBandPress(band.id)}
                style={{
                  backgroundColor: theme.boxBackgrounds.primary,
                  borderWidth: 1,
                  borderColor: rgba(COLORS.black, 0.06),
                }}
              >
                {band.imageUrl ? (
                  <ResultImage>
                    <Image uri={band.imageUrl} />
                  </ResultImage>
                ) : (
                  <PlaceholderImage
                    style={{ backgroundColor: rgba(COLORS.amazingBlue, 0.1) }}
                  >
                    <Text header size="reduced" color={COLORS.amazingBlue}>
                      {getInitials(band.name)}
                    </Text>
                  </PlaceholderImage>
                )}
                <ResultInfo>
                  <Text header size="reduced">
                    {band.name}
                  </Text>
                  {!!band.genres && (
                    <Text
                      size="small"
                      color={COLORS.amazingBlue}
                      style={{ marginTop: 4 }}
                    >
                      {band.genres}
                    </Text>
                  )}
                </ResultInfo>
              </ResultCard>
            ))}
          </Section>
        )}

        {!!results.venues.length && (
          <Section>
            <SectionTitle>
              <Text header size="increased">
                Venues
              </Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: rgba(COLORS.gold, 0.16),
                }}
              >
                <Text size="small" bold>
                  {String(results.venues.length)}
                </Text>
              </View>
            </SectionTitle>
            {results.venues.map((venue) => (
              <ResultCard
                key={venue.id}
                onPress={() => handleVenuePress(venue.id)}
                style={{
                  backgroundColor: theme.boxBackgrounds.primary,
                  borderWidth: 1,
                  borderColor: rgba(COLORS.black, 0.06),
                }}
              >
                {venue.imageUrl ? (
                  <ResultImage>
                    <Image uri={venue.imageUrl} />
                  </ResultImage>
                ) : (
                  <PlaceholderImage
                    style={{ backgroundColor: rgba(COLORS.gold, 0.12) }}
                  >
                    <Text header size="reduced" color={COLORS.gold}>
                      {getInitials(venue.name)}
                    </Text>
                  </PlaceholderImage>
                )}
                <ResultInfo>
                  <Text header size="reduced">
                    {venue.name}
                  </Text>
                  {!!venue.genres && (
                    <Text
                      size="small"
                      color={COLORS.gold}
                      style={{ marginTop: 4 }}
                    >
                      {venue.genres}
                    </Text>
                  )}
                </ResultInfo>
              </ResultCard>
            ))}
          </Section>
        )}

        {!!results.shows.length && (
          <Section>
            <SectionTitle>
              <Text header size="increased">
                Shows
              </Text>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: rgba(COLORS.turquoise, 0.12),
                }}
              >
                <Text size="small" bold color={COLORS.turquoise}>
                  {String(results.shows.length)}
                </Text>
              </View>
            </SectionTitle>
            {results.shows.map((show) => {
              const { day, date } = formatDateTime(show.from, true)
              return (
                <ResultCard
                  key={show.id}
                  onPress={() => handleShowPress(show.id)}
                  style={{
                    backgroundColor: theme.boxBackgrounds.primary,
                    borderWidth: 1,
                    borderColor: rgba(COLORS.black, 0.06),
                  }}
                >
                  {show.imageUrl ? (
                    <ResultImage>
                      <Image uri={show.imageUrl} />
                    </ResultImage>
                  ) : (
                    <PlaceholderImage
                      style={{ backgroundColor: rgba(COLORS.turquoise, 0.1) }}
                    >
                      <Text header size="reduced" color={COLORS.turquoise}>
                        {getInitials(show.name)}
                      </Text>
                    </PlaceholderImage>
                  )}
                  <ResultInfo>
                    <Text header size="reduced">
                      {show.name}
                    </Text>
                    <Text
                      size="small"
                      color={theme.text.tertiary}
                      style={{ marginTop: 4 }}
                    >
                      {`${show.venueName} · ${[day, date].filter(Boolean).join(' ')}`}
                    </Text>
                  </ResultInfo>
                </ResultCard>
              )
            })}
          </Section>
        )}

        {!hasSearched && !query && !activeGenre && (
          <View
            style={{
              marginTop: 40,
              alignItems: 'center',
              paddingHorizontal: 20,
            }}
          >
            <Text
              size="small"
              color={theme.text.tertiary}
              center
            >
              {`Search by name or tap a genre to discover bands, venues, and shows`}
            </Text>
          </View>
        )}
      </ScrollView>
    </Page>
  )
}

export default Search
