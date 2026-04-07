import { Appearance } from 'react-native';
import { createSlice } from '@reduxjs/toolkit';

import { MAPBOX_STYLES } from '../../app/constants';

const initialState = {
  selectedTheme: 'light',
  // mapUrl: MAPBOX_STYLES[Appearance.getColorScheme()],
};

function changeTheme(state, action) {
  const { selectedTheme } = action.payload;
  state.selectedTheme = selectedTheme;

  if (selectedTheme === 'dark') {
    state.mapUrl = MAPBOX_STYLES.dark;
  } else {
    state.mapUrl = MAPBOX_STYLES.light;
  }
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    changeSelectedTheme: changeTheme,
  },
});

export const { changeSelectedTheme } = themeSlice.actions;

export default themeSlice.reducer;
