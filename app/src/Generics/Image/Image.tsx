import React, { FC, useCallback } from 'react'
import { BlurView } from '@react-native-community/blur'
import FastImage from 'react-native-fast-image'
import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import styled from 'styled-components/native'

const Blur = styled(BlurView)`
  flex: 1;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;
`

const AnimatedBlur = Animated.createAnimatedComponent(Blur)

interface ImageProps {
  uri: string
  shouldBlur?: boolean
  config?: any
}

const Image: FC<ImageProps> = ({ uri, shouldBlur, config }) => {
  const opacity = useSharedValue(shouldBlur ? 1 : 0)
  const loading = useSharedValue(false)

  const handleLoadStart = useCallback(() => {
    if (!shouldBlur) return

    runOnUI(() => {
      'worklet'

      loading.value = true
    })
  }, [loading, shouldBlur])

  const onLoadEnd = useCallback(() => {
    if (!shouldBlur) return

    runOnUI(() => {
      'worklet'

      loading.value = false
      opacity.value = withDelay(100, withTiming(0, { duration: 100 }))
    })()
  }, [loading, opacity, shouldBlur])

  const blurStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
    }),
    []
  )

  const source = {
    uri,
    priority: FastImage.priority.high,
    ...config,
  }

  return (
    <Animated.View
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <AnimatedBlur blurType="dark" style={blurStyle} />

      <FastImage
        style={{ width: '100%', height: '100%' }}
        source={source}
        fallback
        resizeMode={FastImage.resizeMode.cover}
        onLoadStart={handleLoadStart}
        onLoadEnd={onLoadEnd}
      />
    </Animated.View>
  )
}

export default Image
