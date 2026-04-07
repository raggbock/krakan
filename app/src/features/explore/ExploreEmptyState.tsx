import React from 'react';
import styled from 'styled-components/native';

import { Text } from '../../Generics';
import useTranslation from '../locale/useTranslation';

const Container = styled.View`
  margin: 0 10px 24px;
  padding: 20px;
  border-radius: 24px;
`;

const HintList = styled.View`
  margin-top: 14px;
`;

const HintRow = styled.View`
  margin-top: 10px;
`;

export default function ExploreEmptyState() {
  const translate = useTranslation();

  return (
    <Container>
      <Text header size="regular">
        {translate('explore.empty.title')}
      </Text>
      <Text size="reduced" style={{ marginTop: 8 }}>
        {translate('explore.empty.description')}
      </Text>
      <HintList>
        <HintRow>
          <Text bold size="small">
            {translate('explore.empty.artistTitle')}
          </Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.empty.artistDescription')}
          </Text>
        </HintRow>
        <HintRow>
          <Text bold size="small">
            {translate('explore.empty.venueTitle')}
          </Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.empty.venueDescription')}
          </Text>
        </HintRow>
        <HintRow>
          <Text bold size="small">
            {translate('explore.empty.visitorTitle')}
          </Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.empty.visitorDescription')}
          </Text>
        </HintRow>
      </HintList>
    </Container>
  );
}
