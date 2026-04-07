import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import { Text } from '../../Generics';
import useTranslation from '../locale/useTranslation';
import { COLORS, rgba } from '../../utils/colorUtils';

const Card = styled.View`
  padding: 20px;
  border-radius: 24px;
  margin: 10px 10px 18px;
  overflow: hidden;
`;

const Eyebrow = styled(Text)`
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
`;

const StatsRow = styled.View`
  flex-direction: row;
  margin-top: 18px;
  margin-bottom: 8px;
`;

const StatBlock = styled.View`
  flex: 1;
`;

const AudienceList = styled.View`
  margin-top: 8px;
`;

const AudienceCard = styled.View`
  padding: 14px 16px;
  border-radius: 18px;
  margin-bottom: 10px;
`;

type AudienceIntroProps = {
  showsCount: number;
  bandsCount: number;
  venuesCount: number;
};

export default function AudienceIntro({
  showsCount,
  bandsCount,
  venuesCount,
}: AudienceIntroProps) {
  const translate = useTranslation();
  const theme = useTheme();

  return (
    <Card
      style={{
        backgroundColor: theme.boxBackgrounds.tertiary,
        borderWidth: 1,
        borderColor: rgba(COLORS.black, 0.08),
      }}
    >
      <Eyebrow size="small" bold color={theme.text.tertiary}>
        {translate('explore.intro.eyebrow')}
      </Eyebrow>
      <Text header size="large">
        {translate('explore.intro.title')}
      </Text>
      <Text
        size="reduced"
        color={theme.text.tertiary}
        style={{ marginTop: 10 }}
      >
        {translate('explore.intro.description')}
      </Text>
      <StatsRow>
        <StatBlock>
          <Text header size="large">{String(showsCount)}</Text>
          <Text size="small" color={theme.text.tertiary}>
            {translate('explore.intro.stats.shows')}
          </Text>
        </StatBlock>
        <StatBlock>
          <Text header size="large">{String(bandsCount)}</Text>
          <Text size="small" color={theme.text.tertiary}>
            {translate('explore.intro.stats.artists')}
          </Text>
        </StatBlock>
        <StatBlock>
          <Text header size="large">{String(venuesCount)}</Text>
          <Text size="small" color={theme.text.tertiary}>
            {translate('explore.intro.stats.venues')}
          </Text>
        </StatBlock>
      </StatsRow>
      <AudienceList>
        <AudienceCard style={{ backgroundColor: rgba(COLORS.turquoise, 0.12) }}>
          <Text bold>{translate('explore.intro.audiences.artists.title')}</Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.intro.audiences.artists.description')}
          </Text>
        </AudienceCard>
        <AudienceCard style={{ backgroundColor: rgba(COLORS.gold, 0.18) }}>
          <Text bold>{translate('explore.intro.audiences.venues.title')}</Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.intro.audiences.venues.description')}
          </Text>
        </AudienceCard>
        <AudienceCard
          style={{
            backgroundColor: rgba(COLORS.amazingBlue, 0.14),
            marginBottom: 0,
          }}
        >
          <Text bold>{translate('explore.intro.audiences.visitors.title')}</Text>
          <Text size="small" style={{ marginTop: 4 }}>
            {translate('explore.intro.audiences.visitors.description')}
          </Text>
        </AudienceCard>
      </AudienceList>
    </Card>
  );
}
