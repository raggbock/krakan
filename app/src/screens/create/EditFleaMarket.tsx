import React, { useState, useEffect } from 'react'
import { ScrollView, Switch } from 'react-native'
import { useSelector } from 'react-redux'
import styled from 'styled-components/native'

import { Page, Text } from '../../Generics'
import GoBack from '../../components/GoBack/GoBack'
import { selectFleaMarketDetails } from '../../features/fleaMarkets/fleaMarketsSelectors'

const Section = styled.View`
  padding: 16px;
`

const Input = styled.TextInput`
  border-width: 1px;
  border-color: ${(props) => props.theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  color: ${(props) => props.theme.colors.text};
`

const Row = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
`

const Button = styled.TouchableOpacity`
  background-color: ${(props) => props.theme.colors.primary};
  padding: 16px;
  border-radius: 8px;
  align-items: center;
  margin: 16px;
`

export default function EditFleaMarket({ navigation }) {
  const details = useSelector(selectFleaMarketDetails)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPermanent, setIsPermanent] = useState(false)

  useEffect(() => {
    if (details) {
      setName(details.name)
      setDescription(details.description)
      setIsPermanent(details.isPermanent)
    }
  }, [details])

  function handleSave() {
    // TODO: dispatch update action
    navigation.goBack()
  }

  return (
    <Page>
      <GoBack />
      <ScrollView>
        <Section>
          <Text size="xlarge" bold>
            Redigera loppis
          </Text>
        </Section>

        <Section>
          <Text bold>Namn</Text>
          <Input value={name} onChangeText={setName} />
        </Section>

        <Section>
          <Text bold>Beskrivning</Text>
          <Input
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </Section>

        <Section>
          <Row>
            <Text bold>Permanent loppis</Text>
            <Switch value={isPermanent} onValueChange={setIsPermanent} />
          </Row>
        </Section>

        <Button onPress={handleSave}>
          <Text bold color="white">
            Spara
          </Text>
        </Button>
      </ScrollView>
    </Page>
  )
}
