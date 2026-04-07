import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';

const userLocationSelector = (state: RootState) => state.location.userLocation;
const isFetchingLocationSelector = (state: RootState) => state.location.isFetchingLocation;
const selectedAddressSelector = (state: RootState) => state.location.selectedAddress;

export const locationSelector = createSelector(
  userLocationSelector,
  isFetchingLocationSelector,
  selectedAddressSelector,
  (location, isFetchingUserLocation, selectedAddress) => {
    if (location) {
      const { latitude, longitude } = location;
      const userCoords = { latitude, longitude };

      return { isFetchingUserLocation, userCoords, selectedAddress };
    }

    return {};
  },
);
