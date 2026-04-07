import React from 'react';
import styled from 'styled-components/native';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/core';
import { useSelector } from 'react-redux';

import { SCREEN_NAMES } from '../../app/constants';
import { showsSelector } from '../shows/showsSelectors';
import { bandsSelector } from '../bands/bandsSelectors';
import useTranslation from '../locale/useTranslation';
import { venuesSelector } from '../venues/venuesSelectors';
import { ListSeparator, Title } from '../../components';

import SmallList from './SmallList';
import EventCard from './EventCard';

const StyledList = styled.FlatList`
  flex-grow: 1;
  height: 100%;
`;

const ExploreList = () => {
  const navigation = useNavigation<any>();
  const translate = useTranslation();

  const { shows } = useSelector(showsSelector);
  const { bands } = useSelector(bandsSelector);
  const { venues } = useSelector(venuesSelector);

  function handleNavigateToShowDetails(id: string) {
    navigation.navigate(SCREEN_NAMES.SHOW_DETAILS, { id });
  }

  function onBandItemPress(id: string) {
    navigation.navigate(SCREEN_NAMES.BAND_DETAILS, { id });
  }

  function onVenueItemPress(id: string) {
    navigation.navigate(SCREEN_NAMES.VENUE_DETAILS, { id });
  }

  return (
    <StyledList
      data={shows}
      extraData={shows.length}
      keyExtractor={(item: any) => item.id}
      ItemSeparatorComponent={ListSeparator}
      ListHeaderComponent={
        shows?.length ? <Title>{translate('explore.popularEvents')}</Title> : null
      }
      renderItem={({ item, index }: { item: any; index: number }) => (
        <EventCard show={item} index={index} onPress={handleNavigateToShowDetails} />
      )}
      ListFooterComponent={
        <>
          <SmallList
            items={bands}
            title={translate('explore.bands')}
            onItemPress={onBandItemPress}
          />
          <SmallList
            items={venues}
            title={translate('explore.venues')}
            onItemPress={onVenueItemPress}
          />
        </>
      }
    />
  );
};

export default ExploreList;
