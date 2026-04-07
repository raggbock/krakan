import { ReactNode } from 'react'
import styled from 'styled-components/native'

type Interval = 's' | 'm' | 'l' | 'none'

type Shadow = Interval
type Radius = Interval
type CardSize = Interval
type Margin = Interval
type MB = Interval
type Direction = 'row' | 'column'
type Alignment = 'center' | 'flex-start' | 'flex-end'
type Justification =
  | 'center'
  | 'flex-start'
  | 'flex-end'
  | 'space-between'
  | 'space-evenly'

interface CardProps {
  size?: CardSize
  background?: string
  shadow?: Shadow
  radius?: Radius
  $direction?: Direction
  border?: boolean
  children?: ReactNode
  align?: Alignment
  justify?: Justification
  margin?: Margin
  mb?: MB
}

const generateCardPropsFromSize = ({ size }: { size?: CardSize }) => {
  switch (size) {
    case 's':
      return `padding: 14px;`
    case 'm':
      return `padding: 16px;`
    case 'l':
      return `padding: 18px;`

    default:
      return ''
  }
}

const background = ({
  background,
  theme,
}: {
  background?: string
  theme: any
}) => {
  if (background) return `background-color: ${background};`

  return `background-color: ${theme.boxBackgrounds.primary}`
}

const shadow = ({ shadow, theme }: { shadow?: Shadow; theme: any }) => {
  switch (shadow) {
    case 's':
      return `
        shadow-color: ${theme.shadows.primary};
        shadow-offset: 0px 1px;
        shadow-opacity: 0.18;
        shadow-radius: 1.00px;
      
        elevation: 1;
        `

    case 'm':
      return `
      shadow-color: ${theme.shadows.primary};
      shadow-offset: 0px 3px;
      shadow-opacity: 0.29;
      shadow-radius: 4.65px;
      
      elevation: 7;
      
      `

    case 'l':
      return `
      shadow-color: ${theme.shadows.primary};
        shadow-offset: 0px 7px;
        shadow-opacity: 0.41;
        shadow-radius: 9.11px;
        elevation: 14;
        `

    default:
      return ``
  }
}

const radius = ({ radius }: { radius?: Radius }) => {
  switch (radius) {
    case 's':
      return 'border-radius: 4px'
    case 'm':
      return 'border-radius: 8px'
    case 'l':
      return 'border-radius: 12px'

    default:
      return ''
  }
}

const direction = ({ $direction = 'column' }: { $direction?: Direction }) => {
  return `flex-direction: ${$direction};`
}

const border = ({
  border = false,
  theme,
}: {
  border?: boolean
  theme: any
}) => {
  return border ? `border: 1px solid ${theme.borders.primary}` : ''
}

const alignment = ({ align = 'flex-start' }: { align?: Alignment }) => {
  return !!align ? `align-items: ${align};` : ''
}

const justification = ({
  justify = 'flex-start',
}: {
  justify?: Justification
}) => {
  return !!justify ? `justify-content: ${justify};` : ''
}

const margin = ({ margin = 'none' }: { margin?: Margin }) => {
  switch (margin) {
    case 'l':
      return 'margin: 12px;'
    case 'm':
      return 'margin: 8px;'
    case 's':
      return 'margin: 6px;'

    default:
      return ''
  }
}

const mb = ({ mb = 'none' }: { mb?: MB }) => {
  switch (mb) {
    case 'l':
      return 'margin-bottom: 10px;'
    case 'm':
      return 'margin-bottom: 6px;'
    case 's':
      return 'margin-bottom: 4px;'

    default:
      return ''
  }
}

const Card = styled.View<CardProps>`
  display: flex;
  width: 100%;
  overflow: hidden;
  ${background};
  ${shadow};
  ${radius};
  ${direction};
  ${generateCardPropsFromSize};
  ${border}
  ${alignment}
  ${justification}
  ${margin}
  ${mb}
`

export default Card
