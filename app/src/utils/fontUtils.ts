export const FONTS = {
  light: 'Inter-Light',
  regular: 'Inter-Regular',
  bold: 'Inter-Bold',
  header: 'Kodchasan-Bold',
};

export const TEXT_SIZES = {
  min: {
    fontSize: 9,
    lineHeight: 10,
  },
  small: {
    fontSize: 12,
    lineHeight: 13,
  },
  reduced: {
    fontSize: 15,
    lineHeight: 18,
  },
  regular: {
    fontSize: 16,
    lineHeight: 20,
  },
  increased: {
    fontSize: 19,
    lineHeight: 25,
  },
  large: {
    fontSize: 24,
    lineHeight: 28,
  },
  larger: {
    fontSize: 28,
    lineHeight: 30,
  },
  huge: {
    fontSize: 31,
    lineHeight: 32,
  },
  giant: {
    fontSize: 46,
    lineHeight: 62,
  },
};

export const SIZE_NAMES = [
  'small',
  'reduced',
  'regular',
  'increased',
  'large',
  'larger',
  'huge',
  'giant',
];

export function getFontSize(sizeName = 'regular') {
  return TEXT_SIZES[sizeName].fontSize;
}

export function getLineHeight(sizeName = 'regular') {
  return TEXT_SIZES[sizeName].lineHeight;
}
