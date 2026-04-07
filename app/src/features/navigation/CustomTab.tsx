import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components/native'
import { View } from 'react-native'

import Icon from '../../components/Icon/Icon'
import { Text } from '../../Generics'
import { COLORS } from '../../utils/colorUtils'

const Container = styled.TouchableOpacity`
  flex: auto;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 10px;
`

const Badge = styled(View)`
  position: absolute;
  top: 4px;
  right: 12px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background-color: ${COLORS.cottonCandyRed};
  align-items: center;
  justify-content: center;
  padding: 0 4px;
`

const CustomTab = ({ icon, onPress, isActive, badge }) => {
  return (
    <Container onPress={onPress} activeOpacity={0.9}>
      <Icon active={isActive} name={icon} />
      {badge > 0 && (
        <Badge>
          <Text size="small" bold color={COLORS.white}>
            {badge > 9 ? '9+' : String(badge)}
          </Text>
        </Badge>
      )}
    </Container>
  )
}

export default CustomTab

CustomTab.propTypes = {
  icon: PropTypes.string.isRequired,
  onPress: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
  badge: PropTypes.number,
}

CustomTab.defaultProps = {
  badge: 0,
}
