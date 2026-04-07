import React, { FC, ReactNode } from 'react'
import styled from 'styled-components/native'
import { SafeAreaView } from 'react-native-safe-area-context'

const Container = styled(SafeAreaView)<{ vertical?: boolean }>`
  padding-vertical: ${(props) => (props.vertical ? 10 : 0)};px
  margin-horizontal: 10px
  height: 100%;
`

interface ListContainerProps {
  vertical?: boolean
  children: ReactNode
}

const ListContainer: FC<ListContainerProps> = ({ children, vertical }) => {
  return <Container vertical={vertical}>{children}</Container>
}

export default ListContainer
