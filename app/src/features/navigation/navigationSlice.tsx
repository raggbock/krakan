import { createSlice } from '@reduxjs/toolkit';

import { authSignInSuccess, authSignOut } from '../auth/authSlice';
import { contextClientsSuccess } from '../context/contextSlice';

interface NavigationState {
  shouldShowSignIn: boolean;
}

const initialState: NavigationState = {
  shouldShowSignIn: true,
};

function navigateToMain(state: NavigationState) {
  state.shouldShowSignIn = false;
}

function handleSignInSuccess(state: NavigationState) {
  state.shouldShowSignIn = false;
}

function handleSignOut(state: NavigationState) {
  state.shouldShowSignIn = true;
}

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    navigationNavigate: navigateToMain,
  },
  extraReducers: (builder) => {
    builder
      .addCase(authSignInSuccess, handleSignInSuccess)
      .addCase(authSignOut, handleSignOut)
      .addCase(contextClientsSuccess, handleSignInSuccess);
  },
});

export const { navigationNavigate } = navigationSlice.actions;

export default navigationSlice.reducer;
