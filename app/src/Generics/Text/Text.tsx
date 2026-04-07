import React, { FC } from 'react';
import styled from 'styled-components/native';

import { getFontSize, getLineHeight, FONTS } from '../../utils/fontUtils';

const StyledText = styled.Text<{
  $font: string;
  $size: string;
  $color?: string | any;
  $center?: boolean;
  $align?: string;
  $numberOfLines?: number;
}>`
  font-family: ${(props) => props.$font};
  font-size: ${(props) => getFontSize(props.$size)}px;
  line-height: ${(props) => getLineHeight(props.$size)}px;
  color: ${(props) => (props.$color ? props.$color : props.theme.text.primary)};
  text-align: ${(props) => (props.$center ? 'center' : props.$align)};
`;

type Alignments = 'left' | 'center' | 'right';

type FontSizes =
  | 'small'
  | 'reduced'
  | 'regular'
  | 'increased'
  | 'large'
  | 'larger'
  | 'huge'
  | 'giant';

type TextProps = {
  bold?: boolean;
  center?: boolean;
  header?: boolean;
  align?: Alignments;
  size?: FontSizes;
  color?: string;
  numberOfLines?: number;
  style?: any;
  children: string;
};

const Text: FC<TextProps> = ({
  bold = false,
  center = false,
  align = 'left',
  header = false,
  size = 'regular',
  color = undefined,
  numberOfLines = undefined,
  style = undefined,
  children = '',
}) => {
  function resolveFont() {
    if (bold && !header) return FONTS.bold;
    if (bold && header) return FONTS.header;
    if (header && !bold) return FONTS.header;

    return FONTS.regular;
  }

  return (
    <StyledText
      $font={resolveFont()}
      $center={center}
      $align={align}
      $size={size}
      $color={color}
      $numberOfLines={numberOfLines}
      style={style}>
      {children}
    </StyledText>
  );
};

export default Text;
