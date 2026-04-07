import React, { useRef } from 'react';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/core';
import { useSelector } from 'react-redux';
import styled from 'styled-components/native';
import { FlatList } from 'react-native';

import { SCREEN_NAMES } from '../../app/constants';
import { showsSelector } from '../shows/showsSelectors';
import { Title, ListSeparator, ListContainer } from '../../components';
import useTranslation from '../locale/useTranslation';

import NextEvent from './NextEvent';

const StyledFlatList = styled(FlatList)`
  flex-grow: 1;
  padding: 10px;
  width: 100%;
`;

function NextUpList() {
  const navigation = useNavigation<any>();
  const translate = useTranslation();
  const scrollRef = useRef<FlatList<any> | null>(null);
  const { nextShows } = useSelector(showsSelector);

  function handleNavigateToShowDetails(id: string) {
    navigation.navigate(SCREEN_NAMES.SHOW_DETAILS, { id });
  }

  if (!nextShows.length) return null;

  return (
    <>
      <ListContainer>
        <Title>{translate('explore.featuredEvents')}</Title>
      </ListContainer>
      <StyledFlatList
        data={nextShows}
        horizontal
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <ListSeparator horizontal />}
        initialScrollIndex={0}
        ref={scrollRef}
        keyExtractor={(item: any) => item.id}
        pagingEnabled
        renderItem={({ item }: { item: any }) => (
          <NextEvent show={item} onPress={handleNavigateToShowDetails} />
        )}
      />
    </>
  );
}

export default React.memo(NextUpList);
