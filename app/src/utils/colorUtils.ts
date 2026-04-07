export const COLORS = {
  white: '#ffffff',
  blueGray: '#F1F5F9',
  boneWhite: '#fafafa',
  black: '#0A0F0D',
  iosBlue: '#007aff', // iOS blue
  nero: '#434343',
  gray: '#A8A8A8',
  lightGray: '#D3D3D3',
  turquoise: '#369d94',
  amazingBlue: '#55B9F3',
  cottonCandyRed: '#f35353',
  laGrange: '#9353f3',
  facebook: '#3b5998',

  darkerBlueGray: '#E1E5F2',
  limeGreen: '#77D84A',
  gold: '#F4CA33',
  yellow: '#FAFB7B',
  apple: '#666666',
  cream: '#F7F5F2',
};

export const DARK_THEME = {
  name: 'dark',
  tabNavigation: {
    active: COLORS.amazingBlue,
    passive: COLORS.nero,
  },
  text: {
    primary: COLORS.boneWhite,
    secondary: COLORS.nero,
    tertiary: COLORS.apple,
  },
  borders: {
    primary: COLORS.gray,
  },
  backgrounds: {
    primary: COLORS.nero,
    secondary: COLORS.white,
  },
  boxBackgrounds: {
    primary: COLORS.apple,
    secondary: COLORS.nero,
    tertiary: COLORS.white,
  },
  screenBackgrounds: {
    primary: COLORS.nero,
    secondary: COLORS.black,
    tertiary: COLORS.lightGray,
  },
  shadows: {
    primary: 'transparent',
  },
};

export const LIGHT_THEME = {
  name: 'light',
  tabNavigation: {
    active: COLORS.amazingBlue,
    passive: COLORS.gray,
  },
  text: {
    primary: COLORS.nero,
    secondary: COLORS.white,
    tertiary: COLORS.apple,
  },
  borders: {
    primary: COLORS.gray,
  },
  backgrounds: {
    primary: COLORS.white,
    secondary: COLORS.nero,
  },
  boxBackgrounds: {
    primary: COLORS.white,
    secondary: COLORS.nero,
    tertiary: COLORS.blueGray,
  },
  screenBackgrounds: {
    primary: COLORS.cream,
    secondary: COLORS.nero,
    tertiary: COLORS.lightGray,
  },
  shadows: {
    primary: COLORS.gray,
  },
};

/**
 * Adjust the brightness of an HEX color
 * @param {string} hex - HEX color code
 * @param {Number} amount Amount to adjust
 * @returns {string} - Adjusted HEX color code
 */
function adjustColorBrightness(hex, amount) {
  return `#${hex
    .replace(/^#/, '')
    .replace(/../g, (color) =>
      `0${Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(
        16,
      )}`.substr(-2),
    )}`;
}

/**
 * Darken an HEX color
 * @param {string} hex - HEX color code
 * @param {Number} amount Amount to darken
 * @returns {string} - Darkened HEX color code
 */
export function darken(hex, amount) {
  return adjustColorBrightness(hex, -amount);
}

/**
 * Brighten an HEX color
 * @param {string} hex - HEX color code
 * @param {Number} amount Amount to brighten
 * @returns {string} - Brightened HEX color code
 */
export function brighten(hex, amount) {
  return adjustColorBrightness(hex, amount);
}

/**
 * Get whether the current theme is dark theme or not
 * @param {Object} themeContext - Styled theme context object
 * @returns {boolean} - Whether theme is dark theme or not
 */
export function isDarkTheme(themeContext) {
  return !!themeContext && themeContext.name === DARK_THEME.name;
}

/**
 * Convert an HEX color string to RGBA
 * @param {string} hex      - Hex color code
 * @param {Number} alpha    - Alpha number
 * @returns {string}        - RGBA color
 */
export function rgba(hex, alpha = 1) {
  const [r, g, b] = hex.match(/\w\w/g).map((x) => parseInt(x, 16));

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
