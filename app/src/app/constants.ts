export const SCREEN_NAMES: { [key: string]: any } = {
  TABS: {
    EXPLORE: 'EXPLORE',
    AUTH: 'AUTH',
  },

  // Main
  EXPLORE: 'EXPLORE',
  SEARCH: 'SEARCH',
  MAP: 'MAP',

  PROFILE: 'PROFILE',
  AUTH: 'AUTH',
  CREATE_USER: 'CREATE_USER',

  FLEA_MARKET_DETAILS: 'FLEA MARKET DETAILS',
  CREATE_FLEA_MARKET: 'CREATE FLEA MARKET',
  EDIT_FLEA_MARKET: 'EDIT FLEA MARKET',
}

export const STORAGE_KEYS = {
  locale: '@loppan:locale',
  firstTimeUser: '@loppan:firsttimeuser',
}

export const LOCALE_TAGS = {
  en: 'en',
  sv: 'sv',
}

export const USER_TYPES = {
  visitor: 1,
  organizer: 2,
}

export const MAPBOX_STYLES = {
  light: 'mapbox://styles/developergigapp/ckzh37z5q00b014p8ytdevyk5',
  dark: 'mapbox://styles/developergigapp/ckthbk1mk52wv17p5xglgb6tw',
}

export const RADIUS_FILTER = {
  min: 0,
  max: 60,
}
