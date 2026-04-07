import React, { FC, ReactNode } from 'react'
import styled from 'styled-components/native'
import { Text } from '../../Generics'

const StyledText = styled(Text)<{ background?: boolean }>`
  padding: 15px 0 10px 0;
  background-color: ${(props) =>
    props.background ? props.theme.backgrounds.primary : 'transparent'};
`

interface TitleProps {
  center?: boolean
  background?: boolean
  numberOfLines?: number
  color?: any
  children: string
}

const Title: FC<TitleProps> = ({
  center = false,
  background = false,
  numberOfLines,
  color,
  children,
}) => {
  return (
    <StyledText
      header
      background={background}
      size="increased"
      center={center}
      numberOfLines={numberOfLines}
      color={color}
    >
      {children}
    </StyledText>
  )
}

export default Title
