import React, { useEffect, useState } from 'react';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/core';
import { useSelector } from 'react-redux';

import { SCREEN_NAMES, USER_TYPES } from '../../app/constants';
import { AppDispatch, RootState, useAppDispatch } from '../../app/store';
import ExploreEmptyState from '../../features/explore/ExploreEmptyState';
import ExploreHub from '../../features/explore/ExploreHub';
import { requestGetBands } from '../../features/bands/bandsSlice';
import { bandsSelector } from '../../features/bands/bandsSelectors';
import { contextSelector } from '../../features/context/contextSelectors';
import { requestGetShows } from '../../features/shows/showsSlice';
import { showsSelector } from '../../features/shows/showsSelectors';
import { requestGetVenues } from '../../features/venues/venuesSlice';
import { venuesSelector } from '../../features/venues/venuesSelectors';
import { Page } from '../../Generics';

const Explore = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const dispatch = useAppDispatch();
  const { isLoading, shows } = useSelector(showsSelector);
  const { bands } = useSelector(bandsSelector);
  const { venues } = useSelector(venuesSelector);
  const { contextDetails, contextUserType, contextUser } = useSelector(contextSelector);
  const signUpDetails = useSelector((state: RootState) => state.auth.signUpDetails);
  const signUpUserType = signUpDetails.userType;
  const resolvedUserType = contextUserType || signUpUserType || USER_TYPES.visitor;
  const [audienceMode, setAudienceMode] = useState(resolvedUserType);
  const requesterId =
    audienceMode === USER_TYPES.band
      ? contextDetails?.bands?.[0]?.id
      : audienceMode === USER_TYPES.venue
        ? contextDetails?.venues?.[0]?.id
        : undefined;

  const isExploreEmpty =
    !isLoading && shows.length === 0 && bands.length === 0 && venues.length === 0;

  function handleRefresh() {
    dispatch(requestGetShows());
    dispatch(requestGetBands());
    dispatch(requestGetVenues());
  }

  function handleNavigateToShowDetails(id: string) {
    navigation.navigate({
      name: SCREEN_NAMES.SHOW_DETAILS,
      params: { id },
      merge: false,
    });
  }

  function handleNavigateToBandDetails(id: string) {
    navigation.navigate({
      name: SCREEN_NAMES.BAND_DETAILS,
      params: { id },
      merge: false,
    });
  }

  function handleNavigateToVenueDetails(id: string) {
    navigation.navigate({
      name: SCREEN_NAMES.VENUE_DETAILS,
      params: { id },
      merge: false,
    });
  }

  useEffect(() => {
    handleRefresh();
  }, []);

  useEffect(() => {
    setAudienceMode(resolvedUserType);
  }, [resolvedUserType]);

  return (
    <Page safe>
      {isExploreEmpty ? (
        <ExploreEmptyState />
      ) : (
        <ExploreHub
          shows={shows}
          bands={bands}
          venues={venues}
          isLoading={isLoading}
          audienceMode={audienceMode}
          requesterProfile={{
            userType: audienceMode,
            requesterId,
            name:
              contextUser?.name ||
              [signUpDetails?.firstname, signUpDetails?.lastname]
                .filter(Boolean)
                .join(' '),
            email: signUpDetails?.email,
          }}
          onAudienceModeChange={setAudienceMode}
          onShowPress={handleNavigateToShowDetails}
          onBandPress={handleNavigateToBandDetails}
          onVenuePress={handleNavigateToVenueDetails}
          onRefresh={handleRefresh}
        />
      )}
    </Page>
  );
};

export default Explore;

