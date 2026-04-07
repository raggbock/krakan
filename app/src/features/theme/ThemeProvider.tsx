import React, { FC, ReactNode, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { ThemeProvider as StyledThemeProvider } from 'styled-components/native';

import { RootState } from '../../app/store';

import { LIGHT_THEME, DARK_THEME } from '../../utils/colorUtils';

const themes = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};

const ThemeProviderCompat = StyledThemeProvider as unknown as React.ComponentType<{
  theme: typeof LIGHT_THEME;
  children: ReactNode;
}>;

interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeProvider: FC<ThemeProviderProps> = ({ children }) => {
  const { selectedTheme } = useSelector((state: RootState) => state.theme);

  useEffect(() => {
    StatusBar.setBarStyle(
      selectedTheme === 'dark' ? 'light-content' : 'dark-content',
    );
  }, [selectedTheme]);

  const theme = themes[selectedTheme];
  return (
    <ThemeProviderCompat theme={theme ?? themes.light}>
      {children}
    </ThemeProviderCompat>
  );
};

export default ThemeProvider;

