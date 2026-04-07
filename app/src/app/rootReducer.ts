import { combineReducers } from '@reduxjs/toolkit'

import navigationReducer from '../features/navigation/navigationSlice'
import themeReducer from '../features/theme/themeSlice'
import locationReducer from '../features/location/locationSlice'
import authReducer from '../features/auth/authSlice'
import contextReducer from '../features/context/contextSlice'
import fleaMarketsReducer from '../features/fleaMarkets/fleaMarketsSlice'

export default combineReducers({
  auth: authReducer,
  navigation: navigationReducer,
  location: locationReducer,
  fleaMarkets: fleaMarketsReducer,
  theme: themeReducer,
  context: contextReducer,
})
