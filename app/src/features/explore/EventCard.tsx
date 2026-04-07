import React from 'react';
import { Pressable, View } from 'react-native';
import styled from 'styled-components/native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text, Image, Card } from '../../Generics';
import { formatDateTime } from '../../utils/dateUtils';
import { formatNumberToKm } from '../../utils/stringUtils';

type ShowCardData = {
  id: string;
  name?: string;
  date: string;
  imageUrl?: string;
  distanceKm?: number;
  venue: {
    name?: string;
  };
};

const AnimatedContainer = Animated.createAnimatedComponent(View);

const ImageContainer = styled.View`
  flex: 2;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 220px;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
`;

const Row = styled.View`
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  margin: 2px 0;
`;

interface EventCardProps {
  show: ShowCardData;
  index: number;
  onPress: (id: string) => void;
}

const EventCard = ({ show, index, onPress }: EventCardProps) => {
  const { day, date } = formatDateTime(show.date, true);

  return (
    <AnimatedContainer entering={FadeIn.delay(index * 100)}>
      <Card>
        <Pressable onPress={() => onPress(show.id)}>
          {!!show.imageUrl && (
            <ImageContainer>
              <Image uri={show.imageUrl} />
            </ImageContainer>
          )}
          <View>
            <Row>
              <Text header bold>
                {show.name ?? 'Untitled show'}
              </Text>
            </Row>
            {!!show.distanceKm && (
              <Card size="s" mb="s">
                <Text>{formatNumberToKm(show.distanceKm)}</Text>
              </Card>
            )}
          </View>
          <View>
            <Row>
              <Text>{show.venue?.name ?? 'Venue TBA'}</Text>
            </Row>
            <Row>
              <Text bold style={{ marginRight: 10 }}>
                {day}
              </Text>
              <Text>{date}</Text>
            </Row>
          </View>
        </Pressable>
      </Card>
    </AnimatedContainer>
  );
};

export default EventCard;
