import { useContext } from 'react';

import { translate } from '../../utils/localeUtils';

import LocaleContext from './LocaleContext';

export default function useTranslation(scope = '') {
  const { languageTag } = useContext(LocaleContext);

  return (key: any, options?: any) =>
    translate(`${scope ? `${scope}.` : ''}${key}`, options, languageTag);
}
