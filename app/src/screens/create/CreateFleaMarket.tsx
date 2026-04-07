import React, { useState } from 'react'
import { ScrollView, Switch } from 'react-native'
import styled from 'styled-components/native'

import { Page, Text } from '../../Generics'
import GoBack from '../../components/GoBack/GoBack'

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

export default function CreateFleaMarket({ navigation }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [isPermanent, setIsPermanent] = useState(false)

  function handleCreate() {
    // TODO: dispatch create action
    navigation.goBack()
  }

  return (
    <Page>
      <GoBack />
      <ScrollView>
        <Section>
          <Text size="xlarge" bold>
            Skapa loppis
          </Text>
        </Section>

        <Section>
          <Text bold>Namn</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Namn på loppisen"
          />
        </Section>

        <Section>
          <Text bold>Beskrivning</Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Beskriv din loppis"
            multiline
          />
        </Section>

        <Section>
          <Text bold>Adress</Text>
          <Input
            value={address}
            onChangeText={setAddress}
            placeholder="Gatuadress"
          />
        </Section>

        <Section>
          <Row>
            <Text bold>Permanent loppis</Text>
            <Switch value={isPermanent} onValueChange={setIsPermanent} />
          </Row>
        </Section>

        <Button onPress={handleCreate}>
          <Text bold color="white">
            Skapa
          </Text>
        </Button>
      </ScrollView>
    </Page>
  )
}
