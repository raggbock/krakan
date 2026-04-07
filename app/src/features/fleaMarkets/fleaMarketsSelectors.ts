import { RootState } from '../../app/store'

export const selectFleaMarkets = (state: RootState) =>
  state.fleaMarkets.items

export const selectIsFetchingFleaMarkets = (state: RootState) =>
  state.fleaMarkets.isFetching

export const selectFleaMarketDetails = (state: RootState) =>
  state.fleaMarkets.selectedDetails

export const selectIsFetchingFleaMarketDetails = (state: RootState) =>
  state.fleaMarkets.isFetchingDetails

export const selectRadiusFilter = (state: RootState) =>
  state.fleaMarkets.radiusFilter
