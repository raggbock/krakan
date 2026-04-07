import React, { FC } from 'react'
import { Pressable, FlatList } from 'react-native'

import styled from 'styled-components/native'
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import { Image, Text, Card } from '../../Generics'
import { Title, ListSeparator } from '../../components'

const ImageContainer = styled(Card)`
  align-items: center;
  height: 140px;
  position: relative;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
`

const StyledCard = styled(Card)`
  width: 200px;
`

const ContentCard = styled(Card)`
  align-items: center;
  justify-content: center;
`

const AnimatedItemContainer = Animated.createAnimatedComponent(StyledCard)

interface ItemProps {
  item: any
  onItemPress: any
}

const Item: FC<ItemProps> = ({ item, onItemPress }) => {
  const scale = useSharedValue(1)

  function handleOnPressIn() {
    scale.value = withDelay(170, withSpring(0.98))
  }

  const image = item.images?.[0] ?? null

  function handleOnPressOut() {
    scale.value = withDelay(200, withSpring(1))
  }

  const animatedItemStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(scale.value, [1, 0], [1, 0], Extrapolate.CLAMP),
      },
    ],
  }))

  return (
    <AnimatedItemContainer
      style={animatedItemStyle}
      radius="l"
      shadow="l"

      // border
    >
      <Pressable
        onPressIn={handleOnPressIn}
        onPressOut={handleOnPressOut}
        onPress={() => onItemPress(item.id)}
      >
        <ImageContainer>
          <Image uri={image} shouldBlur />
        </ImageContainer>
        <ContentCard size="m">
          <Text center numberOfLines={2} header>
            {item.name}
          </Text>
        </ContentCard>
      </Pressable>
    </AnimatedItemContainer>
  )
}

interface SmallListProps {
  items: any
  title: string
  onItemPress: any
}

const SmallList: FC<SmallListProps> = ({ items, title, onItemPress }) => {
  if (!items) return null

  return (
    <Card>
      <Title>{title}</Title>
      <FlatList
        data={items}
        extraData={items.length}
        horizontal
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <Item item={item} onItemPress={onItemPress} />
        )}
        ItemSeparatorComponent={() => <ListSeparator horizontal />}
        showsHorizontalScrollIndicator={false}
      />
    </Card>
  )
}

export default SmallList
