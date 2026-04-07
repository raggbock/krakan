import styled from 'styled-components/native'

interface SeparatorProps {
  horizontal?: boolean
}

const Separator = styled.View<SeparatorProps>`
  padding-vertical: 10px;
  padding-horizontal: ${(props) => (props.horizontal ? 10 : 0)}px;
`

export default Separator
