import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components/native'
import Animated, {
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import Icon from '../../components/Icon'
import Text from '../../components/Text'
import { COLORS } from '../../utils/colorUtils'
import { getFormattedCurrency } from '../../utils/localeUtils'
import { handleTicketInCart } from '../checkout/checkoutSlice'
import { checkoutSelector } from '../checkout/checkoutSelectors'

const TicketSelectionContainer = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-vertical: 5px;

  border-radius: 6px;

  shadow-offset: 0px 0px;
  shadow-radius: 2.62px;
  elevation: 5;
  shadow-color: ${COLORS.black};

  background-color: ${props => props.theme.backgrounds.primary};

  height: 60px;
`

const TicketNameWrapper = styled.View`
  align-items: center;
`

const TicketName = styled(Text)``

const TicketQuantityWrapper = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`

const TicketQuantityButton = styled.TouchableOpacity`
  ${props => (props.disabled ? 'opacity: 0.2' : '')}
`

const TicketQuantity = styled(Text)`
  width: 20px;
  margin: 0 10px;
`

const AnimatedContainer = Animated.createAnimatedComponent(
  TicketSelectionContainer,
)

export default function TicketOption({ ticket, onLayout }) {
  const { tickets } = useSelector(checkoutSelector)

  const existingTicket = tickets.find(t => t.id === ticket.id)

  const [quantity, setQuantity] = useState(existingTicket?.quantity ?? 0)
  const dispatch = useDispatch()
  const selected = quantity > 0

  const shadowOpacity = useSharedValue(0)

  function handleQuantityPress(nextQuantity) {
    setQuantity(q => q + nextQuantity)

    const nextTicket = {
      id: ticket.id,
      name: ticket.name,
      quantity: quantity + nextQuantity,
      price: ticket.price,
    }

    dispatch(handleTicketInCart({ ticket: nextTicket }))
  }

  useEffect(() => {
    if (selected) {
      runOnUI(() => {
        'worklet'

        shadowOpacity.value = withTiming(0.2)
      })()
    } else {
      runOnUI(() => {
        'worklet'

        shadowOpacity.value = withTiming(0)
      })()
    }
  }, [selected, shadowOpacity])

  const containerStyle = useAnimatedStyle(() => {
    return {
      shadowOpacity: shadowOpacity.value,
    }
  }, [selected])

  return (
    <AnimatedContainer style={containerStyle} onLayout={onLayout}>
      <TicketNameWrapper>
        <TicketName header>{ticket.name}</TicketName>
        <Text selected={selected} size="reduced">
          {getFormattedCurrency(ticket.price, ticket.currency)}
        </Text>
      </TicketNameWrapper>
      <TicketQuantityWrapper>
        <TicketQuantityButton
          disabled={quantity < 1}
          onPress={() => handleQuantityPress(-1)}
        >
          <Icon name="subtract" />
        </TicketQuantityButton>
        <TicketQuantity justify="center" align="center">
          {quantity}
        </TicketQuantity>
        <TicketQuantityButton onPress={() => handleQuantityPress(1)}>
          <Icon name="add" />
        </TicketQuantityButton>
      </TicketQuantityWrapper>
    </AnimatedContainer>
  )
}

TicketOption.propTypes = {
  ticket: PropTypes.objectOf({
    name: PropTypes.string,
    price: PropTypes.string,
    currency: PropTypes.string,
  }).isRequired,
  onLayout: PropTypes.func,
}

TicketOption.defaultProps = {
  onLayout: () => {},
}
