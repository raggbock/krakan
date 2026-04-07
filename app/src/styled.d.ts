import 'styled-components';

declare module '@env' {
  export const API_URL: string;
  export const MOCK_URL: string;
}

declare module 'styled-components' {
  export interface DefaultTheme {
    [key: string]: any;
    tabNavigation?: {
      active?: string;
      passive?: string;
    };
    text: {
      primary?: string;
      secondary?: string;
      tertiary?: string;
      [key: string]: any;
    };
    backgrounds?: {
      primary?: string;
      secondary?: string;
      [key: string]: any;
    };
    boxBackgrounds?: {
      primary?: string;
      secondary?: string;
      tertiary?: string;
      [key: string]: any;
    };
  }
}
