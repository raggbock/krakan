import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { AppThunk } from '../../app/store';
import { auth } from '../firebase/FirebaseAuth';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

interface User {
  uid: string;
  displayName: string;
  email: string;
}

interface AuthState {
  user: User | null;
  error: string | null;
  loading: boolean;
}

const initialState: AuthState = {
  user: null,
  error: null,
  loading: false,
};

const authSlice = createSlice({
  name: 'testAuth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setUser, setError, setLoading } = authSlice.actions;

export const signInWithEmail =
  (email: string, password: string): AppThunk<Promise<void>> =>
  async (dispatch) => {
    try {
      dispatch(setLoading(true));
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      dispatch(
        setUser({
          uid: userCredential.user.uid,
          displayName: userCredential.user.displayName || '',
          email: userCredential.user.email || '',
        }),
      );
    } catch (error) {
      dispatch(setError(error instanceof Error ? error.message : 'Sign in failed'));
    }
  };

export const signOut =
  (): AppThunk<Promise<void>> =>
  async (dispatch) => {
    try {
      dispatch(setLoading(true));
      await firebaseSignOut(auth);
      dispatch(setUser(null));
    } catch (error) {
      dispatch(setError(error instanceof Error ? error.message : 'Sign out failed'));
    }
  };

export default authSlice.reducer;
