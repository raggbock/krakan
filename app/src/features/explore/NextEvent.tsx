import React from 'react';
import styled from 'styled-components/native';
import { Dimensions, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text, Image, Card } from '../../Generics';
import { formatDateTime } from '../../utils/dateUtils';

type NextEventShow = {
  id: string;
  name?: string;
  date: string;
  imageUrl?: string;
  venue: {
    name?: string;
  };
};

interface NextEventProps {
  show: NextEventShow;
  onPress: (id: string) => void;
}

const { width } = Dimensions.get('screen');

const Container = styled(Card)`
  width: ${width - 20};
`;

const AnimatedContainer = Animated.createAnimatedComponent(Container);

const ImageContainer = styled(Card)`
  height: 100px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  margin-bottom: 10px;
  overflow: hidden;
`;

const Row = styled.View`
  width: 100%;
  flex-direction: row;
  align-items: center;
`;

export default function NextEvent({ show, onPress }: NextEventProps) {
  const { day, date } = formatDateTime(show.date, true);

  return (
    <AnimatedContainer entering={FadeIn.delay(300)} shadow="s">
      <Pressable onPress={() => onPress(show.id)}>
        {!!show.imageUrl && (
          <ImageContainer>
            <Image uri={show.imageUrl} />
          </ImageContainer>
        )}
        <Card>
          <Text size="large" header>
            {show.name ?? 'Untitled show'}
          </Text>
          <Row>
            <Text bold style={{ marginRight: 8 }}>
              {day}
            </Text>
            <Text>{date}</Text>
          </Row>
          <Row>
            <Text>{show.venue?.name ?? 'Venue TBA'}</Text>
          </Row>
        </Card>
      </Pressable>
    </AnimatedContainer>
  );
}
