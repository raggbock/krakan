import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/native'

import { SCREEN_NAMES, STORAGE_KEYS } from '../../app/constants'
import { useStorage } from '../storage/useStorage'

import CustomTab from './CustomTab'
import Animated, { SlideOutDown } from 'react-native-reanimated'

const Wrapper = styled.SafeAreaView`
  width: 100%;
  align-items: center;
  justify-content: center;
  z-index: 1;
  background-color: ${(props) => props.theme.screenBackgrounds.primary};
  border-top-width: 1px;
  border-top-color: rgba(10, 15, 13, 0.06);
`

const Container = styled.View`
  flex-direction: row;
  border-radius: 15px;
  background-color: ${(props) => props.theme.screenBackgrounds.primary};
`

function getIcon(route) {
  switch (route) {
    case SCREEN_NAMES.EXPLORE:
      return 'home'
    case SCREEN_NAMES.MAP:
      return 'map'
    case SCREEN_NAMES.SEARCH:
      return 'search'
    case SCREEN_NAMES.PROFILE:
      return 'user'
    default:
      return 'home'
  }
}

const AnimatedWrapper = Animated.createAnimatedComponent(Wrapper)

export default function CustomNavBar({
  state,
  descriptors,
  navigation,
  navRef,
}) {
  const focusedOptions = descriptors[state.routes[state.index].key]
  const { value: firstTimeUser } = useStorage(STORAGE_KEYS.firstTimeUser)

  if (navRef) {
    if (navRef.isReady && !navRef.isReady()) {
      return null
    }

    const navBarVisibleScreens = [
      SCREEN_NAMES.SEARCH,
      SCREEN_NAMES.MAP,
      SCREEN_NAMES.PROFILE,
      SCREEN_NAMES.AUTH,
    ]

    if (!firstTimeUser) navBarVisibleScreens.push(SCREEN_NAMES.EXPLORE)

    const currentRoute = navRef.getCurrentRoute?.()
    const name = currentRoute?.name

    if (!name) {
      return null
    }

    const show = navBarVisibleScreens.includes(name)

    if (!show) return null
  }

  if (focusedOptions?.tabBarVisible === false) {
    return null
  }

  return (
    <AnimatedWrapper
      exiting={SlideOutDown}
      pointerEvents="box-none"
      style={{ zIndex: 1 }}
    >
      <Container>
        {state.routes.map((route, index) => {
          const isActive = state.index === index

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <CustomTab
              key={route.name}
              isActive={isActive}
              onPress={onPress}
              icon={getIcon(route.name)}
            />
          )
        })}
      </Container>
    </AnimatedWrapper>
  )
}

CustomNavBar.propTypes = {
  state: PropTypes.objectOf(PropTypes.any).isRequired,
  descriptors: PropTypes.objectOf(PropTypes.any).isRequired,
  navigation: PropTypes.objectOf(PropTypes.any).isRequired,
  navRef: PropTypes.objectOf(PropTypes.any),
}

CustomNavBar.defaultProps = {
  navRef: undefined,
}
