import { configureStore, ThunkAction, AnyAction, Action } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import rootReducer from './rootReducer';
import reactotron from './reactotron';

const reactotronEnhancer = reactotron.createEnhancer?.();

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  enhancers: (getDefaultEnhancers) =>
    reactotronEnhancer
      ? getDefaultEnhancers().concat(reactotronEnhancer)
      : getDefaultEnhancers(),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunkDispatch = ThunkDispatch<RootState, unknown, AnyAction>;
export const useAppDispatch = () => useDispatch<AppDispatch>();

export default store;
