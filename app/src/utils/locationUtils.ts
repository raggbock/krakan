import Geolocation from '@react-native-community/geolocation';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import { iOS } from './platformUtils';

const getLocation = (options) => {
  return new Promise((resolve, reject) => {
    // Since RN 0.60 removed gelocation we need to use this package
    Geolocation.getCurrentPosition(
      // Success callback
      (position) => resolve(position.coords),

      // Error callback
      reject,

      // Options
      options,
    );
  });
};

export const locationPermissionResultEquals = async (result) => {
  if (iOS) {
    const locationWhenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

    return locationWhenInUse === result;
  }

  const locationFine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

  return locationFine === result;
};

/**
 * Check if device has GRANTED location usage permission (both iOS and Android)
 * @return {Promise<boolean>} - Whether permission is granted or not
 */
export const hasLocationPermission = () =>
  locationPermissionResultEquals(RESULTS.GRANTED);

export const authorizeLocationUsage = async () => {
  let hasPermission = await hasLocationPermission();

  if (iOS && !hasPermission) {
    const requestResultLocationWhenInUse = await request(
      PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    );

    hasPermission = requestResultLocationWhenInUse === RESULTS.GRANTED;
  }

  if (!iOS && !hasPermission) {
    const requestResultLocationFine = await request(
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    );

    hasPermission = requestResultLocationFine === RESULTS.GRANTED;
  }

  if (!hasPermission) {
    throw new Error('error');
  }

  return hasPermission;
};

/**
 * Get the low accuracy location of the device
 * @param  {number}               timeout     The timeout to wait till we get the location
 * @param  {number}               maximumAge  Maximum cache age
 * @return {Promise<Coordinates>}
 */
export const getLowAccuracyLocation = (
  timeout = 10000,
  maximumAge = 900000,
) => {
  const highAccuracyOptions = {
    enableHighAccuracy: false,
    timeout,
    maximumAge,
  };

  return getLocation(highAccuracyOptions);
};

/**
 * Get the high accuracy location of the device
 * @param  {number}               timeout     The timeout to wait till we get the location
 * @param  {number}               maximumAge  Maximum cache age
 * @return {Promise<Coordinates>}
 */
export const getHighAccuracyLocation = (
  timeout = 5000,
  maximumAge = 900000,
) => {
  const highAccuracyOptions = {
    enableHighAccuracy: true,
    timeout,
    maximumAge,
  };

  return getLocation(highAccuracyOptions);
};

export const getLocationWithEitherAccuracy = async () => {
  let result = null;

  try {
    result = await getHighAccuracyLocation();
  } catch (err) {
    result = null;

    try {
      result = await getLowAccuracyLocation();
    } catch (err) {
      result = null;
    }
  }

  if (!result) {
    throw new Error('Unable to get location');
  }

  return result;
};

export function getGeocoderLocation(geocoder) {
  try {
    if (geocoder.lat) {
      return geocoder;
    }

    return geocoder.results[0].geometry.location;
  } catch (err) {
    return null;
  }
}

/**
 *
 * @param {number} latitude
 * @param {number} longitude
 */
export function getAddressFromCoordinated(latitude, longitude) {}
