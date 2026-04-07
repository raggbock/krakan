/**
 * Returns a formatted string with value and km prefix
 * @param {number} value Value of km's (ex: 2.9865)
 * @param {number} numberOfDecimals  Number of decimals to return (ex: 1 = 2.1km)
 * @returns
 */
export function formatNumberToKm(value, numberOfDecimals = 2) {
  if (!value) return '';
  const [km, decimals] = value.toFixed(numberOfDecimals).split('.');

  // ex: 2.001
  if (decimals.charAt(1) === '0') {
    return `${km}km`;
  }

  return `${value.toFixed(numberOfDecimals)}km`;
}
