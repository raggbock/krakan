import React, { FC } from 'react'
import styled from 'styled-components/native'
import { useNavigation } from '@react-navigation/core'

import Icon from '../Icon/Icon'
import { Text } from '../../Generics'

const Container = styled.Pressable`
  flex-direction: row;
  align-items: center;
  align-self: flex-start;
  padding: 10px 4px;
`

interface GoBackProps {
  onGoBack?: () => any
  title?: string
  color?: string
  iconSize?: number
  background?: boolean
  visible?: boolean
}

const GoBack: FC<GoBackProps> = ({
  onGoBack,
  title,
  color,
  iconSize = 22,
  background = false,
  visible = true,
}) => {
  const navigation = useNavigation()

  function handleGoBack() {
    if (onGoBack) {
      onGoBack()
    } else {
      navigation.goBack()
    }
  }

  if (!visible) return null

  return (
    <Container onPress={handleGoBack}>
      <Icon name="chevronLeft" color={color} size={iconSize} />
      {title && (
        <Text bold size="small" style={{ marginLeft: 2 }}>
          {title}
        </Text>
      )}
    </Container>
  )
}

export default GoBack
