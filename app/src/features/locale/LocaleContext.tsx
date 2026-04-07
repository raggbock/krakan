import 'dayjs/locale/sv';
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';

import { setI18nConfig } from '../../utils/localeUtils';
import { noop } from '../../utils/miscUtils';
import { setAcceptLanguage } from '../../api/Request';
import { useStorage } from '../storage/useStorage';
import { STORAGE_KEYS } from '../../app/constants';

dayjs.extend(LocalizedFormat);

const LocaleContext = React.createContext<LocaleContextType>({
  languageTag: '',
  isLoading: true,
  changeLanguage: async (nextLanguageTag: string) => {},
});

type LocaleContextType = {
  languageTag: string;
  isLoading: boolean;
  changeLanguage: (nextLanguageTag: string) => Promise<void>;
};

type Props = {
  children: React.ReactNode;
};

export function LocaleProvider({ children }: Props) {
  const [languageTag, setLanguageTag] = useState('');
  const [isLoading, setLoading] = useState(true);
  const { setStorage, value: storedLocale } = useStorage(STORAGE_KEYS.locale);

  useEffect(() => {
    if (languageTag) {
      setAcceptLanguage(languageTag);
    }
  }, [languageTag]);

  useEffect(() => {
    async function resolve() {
      const storedLocaleValue = storedLocale || 'defaultLocale';
      const resolvedLanguageTag = await setI18nConfig(storedLocaleValue);
      setLanguageTag(resolvedLanguageTag);
      dayjs.locale(resolvedLanguageTag);
      setLoading(false);
    }

    resolve();
  }, [storedLocale]);

  async function changeLanguage(nextLanguageTag: string) {
    const resolvedLanguageTag = await setI18nConfig(nextLanguageTag);

    setStorage(resolvedLanguageTag);
    dayjs.locale(nextLanguageTag);
    setLanguageTag(resolvedLanguageTag);
  }

  const store = {
    isLoading,
    languageTag,
    changeLanguage,
  };

  return (
    <LocaleContext.Provider value={store}>{children}</LocaleContext.Provider>
  );
}

LocaleProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default LocaleContext;
