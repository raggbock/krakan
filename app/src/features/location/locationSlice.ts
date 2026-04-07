import { AnyAction, Dispatch, PayloadAction, ThunkAction, ThunkDispatch, createSlice } from '@reduxjs/toolkit';
import { GAPI_KEY } from '@env';
import axios from 'axios';
import location from './location';

import { getLocationWithEitherAccuracy } from '../../utils/locationUtils';
import { AppDispatch, AppThunk, RootState } from '../../app/store';
import { Address } from '../../types';

interface LocationState {
  isFetchingLocation: boolean;
  locationError: {
    message: string;
    stack?: string;
    name?: string;
  } | null;
  userLocation: location;
  selectedAddress: string | null;
}

const initialState: LocationState = {
  isFetchingLocation: false,
  locationError: null,
  userLocation: {
    longitude: 0,
    latitude: 0
  },
  selectedAddress: null,
};

interface FetchLocationErrorAction {
  type: string;
  payload: {
    error: {
      message: string;
      stack?: string;
      name?: string;
    };
  };
}

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    locationFetchLocationStart: (state: LocationState) => {
      state.locationError = null;
      state.isFetchingLocation = true;
    },
    locationFetchLocationSuccess: (state: LocationState, action: PayloadAction<{ location: location }>) => {
      const { location } = action.payload;
      state.isFetchingLocation = false;
      state.userLocation = location;
    },
    locationFetchLocationError: (state: LocationState, action: FetchLocationErrorAction) => {
      const { error } = action.payload;
      state.isFetchingLocation = false;
      state.locationError = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    },
    locationReverseGeocodeSuccess: (state: LocationState, action: PayloadAction<{ results: any }>) => {
      const { results } = action.payload;
      state.isFetchingLocation = false;
      state.selectedAddress = results.formatted_address;
    },
  },
});

export const {
  locationFetchLocationStart,
  locationFetchLocationSuccess,
  locationFetchLocationError,

  locationReverseGeocodeSuccess,
} = locationSlice.actions;

export function locationGetUserLocation() {
  return async (dispatch: AppDispatch) => {
    try {
      dispatch(locationFetchLocationStart());
      const location = await getLocationWithEitherAccuracy();

      dispatch(locationFetchLocationSuccess({ location }));
    } catch (error) {
      dispatch(locationFetchLocationError({ error: { message: error.message, stack: error.stack, name: error.name } }));
    }
  };
}

export function requestGetAddressFromCoordinates(long: number, lat: number) {
  return async (dispatch: Dispatch) => {
    try {
      dispatch(locationFetchLocationStart());

      const { data } = await axios({
        url: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${long}&key=${GAPI_KEY}`,
        method: 'GET',
      });

      dispatch(locationReverseGeocodeSuccess({ results: data.results[0] }));
    } catch (error) {
      dispatch(locationFetchLocationError({ error: { message: error.message, stack: error.stack, name: error.name } }));
    }
  };
}

export function requestGetCoordinatesFromAddress(address: Address) {
  return async (dispatch: Dispatch) => {
    try {
      dispatch(locationFetchLocationStart());

      const { data } = await axios({
        url: `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${GAPI_KEY}`,
        method: 'GET',
      });

      dispatch(locationReverseGeocodeSuccess({ results: data.results[0] }));
    } catch (error) {
      dispatch(locationFetchLocationError({ error: { message: error.message, stack: error.stack, name: error.name } }));
    }
  };
}

export default locationSlice.reducer;
