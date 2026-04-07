import React, { useMemo, useRef } from 'react'
import { Pressable, View } from 'react-native'
import { useSelector } from 'react-redux'
import { useNavigation } from '@react-navigation/native'
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps'
import styled, { useTheme } from 'styled-components/native'

import { SCREEN_NAMES } from '../../app/constants'
import { showsSelector } from '../../features/shows/showsSelectors'
import { Text } from '../../Generics'
import { COLORS, rgba } from '../../utils/colorUtils'
import { formatDateTime } from '../../utils/dateUtils'

const Container = styled.View`
  flex: 1;
`

const Header = styled.View`
  position: absolute;
  top: 50px;
  left: 16px;
  right: 16px;
  z-index: 10;
`

const HeaderCard = styled.View`
  padding: 14px 18px;
  border-radius: 20px;
`

const CalloutCard = styled.View`
  width: 220px;
  padding: 14px;
  border-radius: 14px;
`

const STOCKHOLM = {
  latitude: 59.3293,
  longitude: 18.0686,
  latitudeDelta: 0.06,
  longitudeDelta: 0.04,
}

const Map = () => {
  const navigation = useNavigation<any>()
  const theme = useTheme()
  const mapRef = useRef<MapView>(null)
  const { shows } = useSelector(showsSelector)

  const markers = useMemo(() => {
    return shows
      .filter(
        (show: any) =>
          show?.venue?.address?.location?.latitude &&
          show?.venue?.address?.location?.longitude,
      )
      .map((show: any) => ({
        id: show.id,
        name: show.name,
        venueName: show.venue?.name ?? '',
        date: show.date,
        coordinate: {
          latitude: show.venue.address.location.latitude,
          longitude: show.venue.address.location.longitude,
        },
      }))
  }, [shows])

  const handleShowPress = (id: string) => {
    navigation.navigate(SCREEN_NAMES.TABS.EXPLORE, {
      screen: SCREEN_NAMES.SHOW_DETAILS,
      params: { id },
    })
  }

  return (
    <Container>
      <Header>
        <HeaderCard
          style={{
            backgroundColor: theme.boxBackgrounds.primary,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Text header size="increased">
            {markers.length ? `${markers.length} shows nearby` : 'Shows map'}
          </Text>
          <Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>
            {markers.length
              ? 'Tap a pin to see details'
              : 'No shows with locations found'}
          </Text>
        </HeaderCard>
      </Header>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={STOCKHOLM}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {markers.map((marker) => {
          const { day, date } = formatDateTime(marker.date, true)

          return (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              pinColor={COLORS.amazingBlue}
            >
              <Callout
                tooltip
                onPress={() => handleShowPress(marker.id)}
              >
                <CalloutCard
                  style={{
                    backgroundColor: COLORS.white,
                    shadowColor: COLORS.black,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Text header size="reduced">
                    {marker.name}
                  </Text>
                  <Text size="small" color={COLORS.nero} style={{ marginTop: 6 }}>
                    {marker.venueName}
                  </Text>
                  <Text size="small" color={COLORS.apple} style={{ marginTop: 4 }}>
                    {[day, date].filter(Boolean).join(' ')}
                  </Text>
                  <View
                    style={{
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: rgba(COLORS.amazingBlue, 0.12),
                      alignItems: 'center',
                    }}
                  >
                    <Text size="small" bold color={COLORS.amazingBlue}>
                      View show
                    </Text>
                  </View>
                </CalloutCard>
              </Callout>
            </Marker>
          )
        })}
      </MapView>
    </Container>
  )
}

export default Map
