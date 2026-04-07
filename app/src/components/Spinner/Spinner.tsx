import React, { FC } from 'react';
import { BarIndicator } from 'react-native-indicators';
import { useTheme } from 'styled-components/native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const SIZES: Record<'xs' | 's' | 'm' | 'l', number> = {
  xs: 22,
  s: 28,
  m: 36,
  l: 48,
};

type SpinnerSize = keyof typeof SIZES;

interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
}

const Indicator = BarIndicator as unknown as React.ComponentType<{
  size: number;
  color: string;
}>;

const Spinner: FC<SpinnerProps> = ({ size = 'm', color }) => {
  const theme = useTheme();
  const finalColor =
    color ?? theme?.tabNavigation?.active ?? theme?.text?.primary ?? '#55B9F3';

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <Indicator size={SIZES[size]} color={finalColor} />
    </Animated.View>
  );
};

export default Spinner;
