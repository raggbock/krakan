import React, { useCallback, useContext, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import styled, { ThemeContext } from 'styled-components/native'
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { View } from 'react-native'

import { COLORS } from '../../utils/colorUtils'
import Icon from '../../components/Icon'
import Button from '../../components/Button'
import Accordion from '../../components/Accordion'
import ScrollableHeader from '../../components/ScrollableHeader'

import TicketOption from './TicketOption'

const tickets = [
  {
    id: 'dkfkdjfjdf898',
    name: 'Ordinarie',
    price: '200',
    currency: 'SEK',
  },
  {
    id: 'fdlkfldkf93898',
    name: 'Ståplats',
    price: '150',
    currency: 'SEK',
  },
  {
    id: 'sdsffddgfllsd893898',
    name: 'Ordinarie',
    price: '200',
    currency: 'SEK',
  },
  {
    id: '023389dfdf98',
    name: 'Ståplats',
    price: '150',
    currency: 'SEK',
  },
  {
    id: '0233892dfdf898',
    name: 'Ordinarie',
    price: '200',
    currency: 'SEK',
  },
  {
    id: '023389289389ssd',
    name: 'Ståplats',
    price: '150',
    currency: 'SEK',
  },
]

const food = [
  {
    id: '0293902odfkldff',
    name: 'Beer 5x',
    price: 200,
    currency: 'SEK',
  },
  {
    id: '0293902odfklddfd5666',
    name: 'Burger',
    price: 110,
    currency: 'SEK',
  },
  {
    id: '0293903498349fjfk2odfkldff',
    name: 'Hot dogs',
    price: 80,
    currency: 'SEK',
  },
  {
    id: '0293902odfklddfd5666',
    name: 'Burger',
    price: 110,
    currency: 'SEK',
  },
  {
    id: '0293903498349fjfk2odfkldff',
    name: 'Hot dogs',
    price: 80,
    currency: 'SEK',
  },
  {
    id: '0293902odfklddfd5666',
    name: 'Burger',
    price: 110,
    currency: 'SEK',
  },
  {
    id: '0293903498349fjfk2odfkldff',
    name: 'Hot dogs',
    price: 80,
    currency: 'SEK',
  },
]

const mockData = [
  {
    title: 'Tickets',
    data: tickets,
  },
  {
    title: 'Drinks and food',
    data: food,
  },
]

const Wrapper = styled.View`
  width: 100%;
  height: 60px;
  margin-vertical: 20px;
  align-items: center;
  justify-content: center;
  background-color: transparent;
`

const Btn = styled(Button)`
  align-items: center;
  justify-content: center;
`

function CheckoutButton({ disabled, onPress }) {
  return (
    <Wrapper>
      <Btn onPress={onPress} disabled={disabled} icon="chevronRight" header>
        Continue to checkout
      </Btn>
    </Wrapper>
  )
}

CheckoutButton.propTypes = {
  disabled: PropTypes.bool,
  onPress: PropTypes.func.isRequired,
}

CheckoutButton.defaultProps = {
  disabled: false,
}

const StyledSheet = styled(BottomSheet)`
  shadow-color: ${COLORS.black};
  shadow-offset: 0 0;

  shadow-opacity: 0.4;
  shadow-radius: 20px;

  elevation: 8;
`

const Container = styled(BottomSheetView)`
  flex: 1;
  position: relative;
  padding: 0 10px;
`

const OptionList = styled(BottomSheetFlatList)`
  flex: 1;
`

const IconWrapper = styled.Pressable`
  padding: 0 20px;
`

export default function TicketSelect({ visible, setVisible, onCheckoutPress }) {
  const ref = useRef(null)
  const listRef = useRef()
  const headerRef = useRef()

  const theme = useContext(ThemeContext)

  const snapPoints = useMemo(() => ['80%'], [])

  function handleClose() {
    ref.current.close()

    setTimeout(() => {
      setVisible(false)
    }, 300)
  }

  const handleHeaderItemPress = useCallback(index => {
    if (listRef.current) {
      const config = {
        animated: true,
        index,
        viewPosition: 0,
      }

      listRef.current.scrollToIndex({
        ...config,
      })
    }
  }, [])

  const handleOnAccordionItemPress = useCallback(index => {
    const config = {
      animated: true,
      index,
      viewPosition: 0,
    }
    if (headerRef.current) {
      headerRef.current.scrollToIndex(config)
    }

    if (listRef.current) {
      listRef.current.scrollToIndex({
        ...config,
      })
    }
  }, [])

  if (!visible) return null

  return (
    <StyledSheet
      snapPoints={snapPoints}
      ref={ref}
      footerComponent={() => <CheckoutButton onPress={onCheckoutPress} />}
      enableOverDrag={false}
      backgroundStyle={{ backgroundColor: theme.backgrounds.primary }}
    >
      <IconWrapper onPress={handleClose}>
        <Icon size={21} name="cancel" />
      </IconWrapper>
      <Container>
        <OptionList
          data={mockData}
          ref={listRef}
          keyExtractor={({ title }) => title}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            return (
              <Accordion
                item={item}
                index={index}
                onItemPress={handleOnAccordionItemPress}
                initiallyExpanded={index === 0}
                renderItem={({ item: accItem, onLayout }) => (
                  <TicketOption ticket={accItem} onLayout={onLayout} />
                )}
              />
            )
          }}
          stickyHeaderIndices={[0]}
          stickySectionHeadersEnabled
          ListHeaderComponent={() => (
            <View style={{ paddingHorizontal: 10 }}>
              <ScrollableHeader
                data={mockData}
                onItemPress={handleHeaderItemPress}
                ref={headerRef}
              />
            </View>
          )}
        />
      </Container>
    </StyledSheet>
  )
}

TicketSelect.propTypes = {
  visible: PropTypes.bool.isRequired,
  setVisible: PropTypes.func.isRequired,
  onCheckoutPress: PropTypes.func.isRequired,
}
