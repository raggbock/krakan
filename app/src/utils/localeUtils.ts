import { I18nManager } from 'react-native';
import { I18n } from 'i18n-js';
import memoize from 'lodash.memoize';

const i18n = new I18n();
i18n.enableFallback = true;

const DEFAULT_LANGUAGE = {
  languageTag: 'en',
  isRTL: false,
};

export const LANGUAGES = {
  english: DEFAULT_LANGUAGE,
  swedish: {
    languageTag: 'sv',
    isRTL: false,
  },
};

export const CURRENCY_CODES = {
  sek: 'SEK',
  nok: 'NOK',
};

const LOCALIZED_CURRENCY_CODES = {
  kr: 'kr',
};

let DEFAULT_CURRENCY_CODE = CURRENCY_CODES.sek;

export function setDefaultCurrencyCode(currencyCode) {
  DEFAULT_CURRENCY_CODE = currencyCode;
}

export function getDefaultCurrencyCode() {
  return DEFAULT_CURRENCY_CODE;
}

const translationFiles = {
  [LANGUAGES.english.languageTag]: () => require('../translations/en.json'),
  [LANGUAGES.swedish.languageTag]: () => require('../translations/sv.json'),
};

export const translate = memoize(
  (key, options, _languageTag = '') => i18n.t(key, options),
  (key, options, languageTag = '') =>
    options ? languageTag + key + JSON.stringify(options) : languageTag + key,
);

const getFileContents = memoize((languageTag) =>
  JSON.stringify(translationFiles[languageTag]()),
);

function getLanguageByTag(languageTag) {
  return (
    Object.values(LANGUAGES).find(
      (language) => language.languageTag === languageTag,
    ) ?? DEFAULT_LANGUAGE
  );
}

export async function setI18nConfig(requestedLanguageTag = 'en') {
  const nextLanguage = getLanguageByTag(requestedLanguageTag);

  const fileContents = await getFileContents(nextLanguage.languageTag);

  i18n.translations[nextLanguage.languageTag] = JSON.parse(fileContents);

  translate.cache.clear();
  I18nManager.forceRTL(nextLanguage.isRTL);
  i18n.locale = nextLanguage.languageTag;

  return nextLanguage.languageTag;
}

function getLocalizedCurrencyCode(currencyCode) {
  switch (currencyCode) {
    case CURRENCY_CODES.sek:
    case CURRENCY_CODES.nok:
      return LOCALIZED_CURRENCY_CODES.kr;

    default:
      return LOCALIZED_CURRENCY_CODES.kr;
  }
}

export function getFormattedCurrency(
  amount,
  currencyCode,
  localizeCurrencyCode = false,
  fallbackCurrencyCode = DEFAULT_CURRENCY_CODE,
  localizeAmount = false,
) {
  if (amount === undefined || amount === null) return null;

  const code = currencyCode ?? fallbackCurrencyCode;
  const number = Number.isInteger(amount) ? amount : Number(amount);

  return `${localizeAmount ? number.toLocaleString() : number} ${
    localizeCurrencyCode ? getLocalizedCurrencyCode(code) : code
  }`;
}

export function getFormattedPrice(amount) {
  if (!amount) return 0;
  return `${
    Number.isInteger(amount)
      ? `${amount},00`
      : Number.parseFloat(amount).toFixed(2)
  }`;
}
