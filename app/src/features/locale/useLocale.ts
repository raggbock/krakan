import { useContext } from 'react';

import LocaleContext from './LocaleContext';

export function useLocale() {
  const context = useContext(LocaleContext);
  return context;
}
