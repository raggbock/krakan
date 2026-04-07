import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { useNavigationContainerRef } from '@react-navigation/core'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTheme } from 'styled-components/native'

import { SCREEN_NAMES } from '../../app/constants'
import { RootState } from '../../app/store'

import ExploreScreen from '../../screens/explore/Explore'
import MapScreen from '../../screens/map/Map'
import SearchScreen from '../../screens/search/Search'
import ProfileScreen from '../../screens/profile/Profile'
import AuthScreen from '../../screens/auth/Auth'

import CustomNavBar from './CustomNavBar'

const Root = createStackNavigator()
const Profile = createStackNavigator()
const Bottom = createBottomTabNavigator()
const Explore = createStackNavigator()

export default function Router() {
  const theme = useTheme()

  const { shouldShowSignIn } = useSelector(
    (state: RootState) => state.navigation,
  )

  const navRef = useNavigationContainerRef()

  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: theme.screenBackgrounds.primary,
      },
    }),
    [theme.screenBackgrounds.primary],
  )

  function ProfileRouter() {
    return shouldShowSignIn ? (
      <Profile.Navigator
        id="profile-auth"
        initialRouteName={SCREEN_NAMES.AUTH}
        screenOptions={{ headerShown: false }}
      >
        <Profile.Screen name={SCREEN_NAMES.AUTH} component={AuthScreen} />
      </Profile.Navigator>
    ) : (
      <Profile.Navigator
        id="profile-main"
        initialRouteName={SCREEN_NAMES.PROFILE}
        screenOptions={{ headerShown: false }}
      >
        <Profile.Screen
          name={SCREEN_NAMES.PROFILE}
          component={ProfileScreen}
        />
        <Profile.Screen
          name={SCREEN_NAMES.CREATE_FLEA_MARKET}
          getComponent={() =>
            require('../../screens/create/CreateFleaMarket').default
          }
        />
        <Profile.Screen
          name={SCREEN_NAMES.EDIT_FLEA_MARKET}
          getComponent={() =>
            require('../../screens/create/EditFleaMarket').default
          }
        />
        <Profile.Screen
          name={SCREEN_NAMES.FLEA_MARKET_DETAILS}
          getComponent={() =>
            require('../../screens/fleaMarket/FleaMarketDetails').default
          }
        />
      </Profile.Navigator>
    )
  }

  function ExploreRouter() {
    return (
      <Explore.Navigator
        id="explore-stack"
        screenOptions={{ headerShown: false }}
        initialRouteName={SCREEN_NAMES.TABS.EXPLORE}
      >
        <Explore.Screen
          name={SCREEN_NAMES.EXPLORE}
          component={ExploreScreen}
        />
        <Explore.Screen
          name={SCREEN_NAMES.FLEA_MARKET_DETAILS}
          getComponent={() =>
            require('../../screens/fleaMarket/FleaMarketDetails').default
          }
        />
      </Explore.Navigator>
    )
  }

  function BottomRouter() {
    return (
      <Bottom.Navigator
        id="bottom-tabs"
        screenOptions={{ headerShown: false }}
        initialRouteName={SCREEN_NAMES.EXPLORE}
        tabBar={({ state, descriptors, navigation }) => (
          <CustomNavBar
            state={state}
            descriptors={descriptors}
            navigation={navigation}
            navRef={navRef}
          />
        )}
      >
        <Bottom.Screen
          name={SCREEN_NAMES.TABS.EXPLORE}
          component={ExploreRouter}
        />
        <Bottom.Screen name={SCREEN_NAMES.SEARCH} component={SearchScreen} />
        <Bottom.Screen name={SCREEN_NAMES.MAP} component={MapScreen} />
        <Bottom.Screen
          name={SCREEN_NAMES.PROFILE}
          component={ProfileRouter}
        />
      </Bottom.Navigator>
    )
  }

  return (
    <NavigationContainer theme={navTheme} ref={navRef}>
      <Root.Navigator id="root-stack" screenOptions={{ headerShown: false }}>
        <Root.Screen name="root" component={BottomRouter} />
      </Root.Navigator>
    </NavigationContainer>
  )
}
