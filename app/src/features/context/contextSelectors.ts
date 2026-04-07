import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';

const contextUserDetailsSelector = (state: RootState) =>
  state.context.entities.userDetails;
export const contextUserIdSelector = (state: RootState) =>
  state.context.entities.userDetails.user?.id ?? '';

const contextUserSelector = (state: RootState) => state.context.entities.userDetails.user;

const contextUserTypeSelector = (state: RootState) =>
  state.context.entities.userDetails.userType;

const contextLoadingSelector = (state: RootState) => state.context.isFetchingContext;

export const contextSelector = createSelector(
  contextUserDetailsSelector,
  contextUserSelector,
  contextUserTypeSelector,
  contextLoadingSelector,
  (contextDetails, contextUser, contextUserType, contextLoading) => ({
    contextDetails,
    contextUser,
    contextUserType,
    contextLoading,
  }),
);
