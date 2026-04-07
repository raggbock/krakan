import React, { FC, ReactNode } from 'react'
import styled from 'styled-components/native'
import { SafeAreaView } from 'react-native-safe-area-context'

const StyledSafePage = styled(SafeAreaView)`
  display: flex;
  flex: 1;
  padding: 0 10px;
`

const StyledPage = styled.View`
  display: flex;
  flex: 1;
  padding: 0 10px;
`

interface PageProps {
  children: ReactNode
  safe?: boolean
}

const Page: FC<PageProps> = ({ children, safe }) => {
  if (safe) {
    return (
      <StyledSafePage>
        {children}
      </StyledSafePage>
    )
  }

  return (
    <StyledPage>
      {children}
    </StyledPage>
  )
}

export default Page
