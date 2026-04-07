import React, { FC, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import styled, { useTheme } from 'styled-components/native';

import { Page, Text } from '../../Generics';
import { RootState, useAppDispatch } from '../../app/store';
import { USER_TYPES } from '../../app/constants';
import { rgba, COLORS } from '../../utils/colorUtils';
import useTranslation from '../../features/locale/useTranslation';
import {
  requestCreateUser,
  signInWithEmailPassword,
  authUpdateSignUpDetails,
} from '../../features/auth/authSlice';

type AuthMode = 'signIn' | 'signUp';

type RoleOption = {
  key: number;
  label: string;
  description: string;
};

const Shell = styled(ScrollView)`
  flex: 1;
`;

const Hero = styled.View`
  padding: 24px 0 12px;
`;

const Eyebrow = styled(Text)`
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const Panel = styled.View`
  margin-top: 10px;
  padding: 22px 18px 18px;
  border-radius: 24px;
`;

const TabRow = styled.View`
  flex-direction: row;
  margin-top: 20px;
  margin-bottom: 18px;
`;

const TabButton = styled(Pressable)`
  flex: 1;
  padding: 12px 14px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const FieldBlock = styled.View`
  margin-bottom: 14px;
`;

const FieldInput = styled(TextInput)`
  width: 100%;
  min-height: 54px;
  border-radius: 16px;
  padding: 15px 16px;
  font-size: 16px;
`;

const TwoColumnRow = styled.View`
  flex-direction: row;
  gap: 12px;
`;

const HalfField = styled.View`
  flex: 1;
`;

const RoleRail = styled.View`
  margin-top: 6px;
`;

const RoleButton = styled(Pressable)`
  width: 100%;
  padding: 16px;
  border-radius: 18px;
  margin-bottom: 10px;
`;

const ActionButton = styled(Pressable)`
  width: 100%;
  min-height: 56px;
  border-radius: 18px;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
`;

const Footnote = styled.View`
  margin-top: 16px;
`;

const Divider = styled.View`
  height: 1px;
  width: 100%;
  margin: 18px 0;
`;

function getErrorMessage(error?: { message?: string } | null): string | null {
  if (!error?.message) {
    return null;
  }

  return error.message;
}

const Auth: FC = () => {
  const appDispatch = useAppDispatch();
  const theme = useTheme();
  const translate = useTranslation();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedRole, setSelectedRole] = useState<number>(USER_TYPES.visitor);

  const {
    isLoggingIn,
    isCreatingUser,
    loginError,
    createUserError,
  } = useSelector((state: RootState) => state.auth);

  const isBusy = isLoggingIn || isCreatingUser;

  const roleOptions: RoleOption[] = useMemo(
    () => [
      {
        key: USER_TYPES.visitor,
        label: translate('auth.roles.visitor.title'),
        description: translate('auth.roles.visitor.description'),
      },
      {
        key: USER_TYPES.band,
        label: translate('auth.roles.band.title'),
        description: translate('auth.roles.band.description'),
      },
      {
        key: USER_TYPES.venue,
        label: translate('auth.roles.venue.title'),
        description: translate('auth.roles.venue.description'),
      },
    ],
    [translate],
  );

  const activeError =
    mode === 'signIn' ? getErrorMessage(loginError) : getErrorMessage(createUserError);

  function validateSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert(translate('auth.validation.title'), translate('auth.validation.signIn'));
      return false;
    }

    return true;
  }

  function validateSignUp() {
    if (
      !firstname.trim() ||
      !lastname.trim() ||
      !email.trim() ||
      !phoneNumber.trim() ||
      !password.trim()
    ) {
      Alert.alert(translate('auth.validation.title'), translate('auth.validation.signUp'));
      return false;
    }

    return true;
  }

  function handleRoleSelection(role: number) {
    setSelectedRole(role);
    appDispatch(authUpdateSignUpDetails({ details: { userType: role } }));
  }

  function handleSubmit() {
    if (mode === 'signIn') {
      if (!validateSignIn()) {
        return;
      }

      appDispatch(signInWithEmailPassword(email.trim(), password));
      return;
    }

    if (!validateSignUp()) {
      return;
    }

    appDispatch(
      authUpdateSignUpDetails({
        details: {
          firstname: firstname.trim(),
          lastname: lastname.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          password,
          userType: selectedRole,
        },
      }),
    );

    appDispatch(
      requestCreateUser({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      }),
    );
  }

  const title =
    mode === 'signIn'
      ? translate('auth.signIn.title')
      : translate('auth.signUp.title');
  const subtitle =
    mode === 'signIn'
      ? translate('auth.signIn.description')
      : translate('auth.signUp.description');

  const ctaLabel = isBusy
    ? translate('auth.common.loading')
    : mode === 'signIn'
      ? translate('auth.signIn.submit')
      : translate('auth.signUp.submit');

  return (
    <Page safe>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Shell
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <Hero>
            <Eyebrow size="small" bold color={COLORS.amazingBlue}>
              {translate('auth.hero.eyebrow')}
            </Eyebrow>
            <Text header size="giant" style={{ marginTop: 10 }}>
              {translate('auth.hero.title')}
            </Text>
            <Text
              size="reduced"
              color={theme.text.tertiary}
              style={{ marginTop: 12, maxWidth: 340 }}
            >
              {translate('auth.hero.description')}
            </Text>
          </Hero>

          <Panel
            style={{
              backgroundColor: rgba(COLORS.black, 0.03),
              borderWidth: 1,
              borderColor: rgba(COLORS.black, 0.06),
            }}
          >
            <TabRow>
              <TabButton
                onPress={() => setMode('signIn')}
                style={{
                  backgroundColor:
                    mode === 'signIn' ? COLORS.amazingBlue : rgba(COLORS.black, 0.04),
                  marginRight: 8,
                }}
              >
                <Text
                  bold
                  color={mode === 'signIn' ? COLORS.white : theme.text.primary}
                >
                  {translate('auth.switch.signIn')}
                </Text>
              </TabButton>
              <TabButton
                onPress={() => setMode('signUp')}
                style={{
                  backgroundColor:
                    mode === 'signUp' ? COLORS.gold : rgba(COLORS.black, 0.04),
                }}
              >
                <Text bold color={theme.text.primary}>
                  {translate('auth.switch.signUp')}
                </Text>
              </TabButton>
            </TabRow>

            <Text header size="large">
              {title}
            </Text>
            <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
              {subtitle}
            </Text>

            {mode === 'signUp' && (
              <RoleRail style={{ marginTop: 20 }}>
                <Text header size="increased" style={{ marginBottom: 12 }}>
                  {translate('auth.roles.heading')}
                </Text>
                {roleOptions.map((option) => {
                  const isActive = selectedRole === option.key;
                  const accent =
                    option.key === USER_TYPES.band
                      ? COLORS.amazingBlue
                      : option.key === USER_TYPES.venue
                        ? COLORS.gold
                        : COLORS.turquoise;

                  return (
                    <RoleButton
                      key={option.key}
                      onPress={() => handleRoleSelection(option.key)}
                      style={{
                        backgroundColor: isActive ? rgba(accent, 0.14) : theme.boxBackgrounds.primary,
                        borderWidth: 1,
                        borderColor: isActive ? accent : rgba(COLORS.black, 0.08),
                      }}
                    >
                      <Text bold>{option.label}</Text>
                      <Text size="small" color={theme.text.tertiary} style={{ marginTop: 6 }}>
                        {option.description}
                      </Text>
                    </RoleButton>
                  );
                })}
              </RoleRail>
            )}

            <Divider style={{ backgroundColor: rgba(COLORS.black, 0.08) }} />

            {mode === 'signUp' && (
              <TwoColumnRow>
                <HalfField>
                  <FieldBlock>
                    <Text size="small" bold style={{ marginBottom: 8 }}>
                      {translate('auth.fields.firstName')}
                    </Text>
                    <FieldInput
                      value={firstname}
                      onChangeText={setFirstname}
                      autoCapitalize="words"
                      placeholder={translate('auth.placeholders.firstName')}
                      placeholderTextColor={theme.text.tertiary}
                      style={{
                        backgroundColor: theme.boxBackgrounds.primary,
                        color: theme.text.primary,
                      }}
                    />
                  </FieldBlock>
                </HalfField>
                <HalfField>
                  <FieldBlock>
                    <Text size="small" bold style={{ marginBottom: 8 }}>
                      {translate('auth.fields.lastName')}
                    </Text>
                    <FieldInput
                      value={lastname}
                      onChangeText={setLastname}
                      autoCapitalize="words"
                      placeholder={translate('auth.placeholders.lastName')}
                      placeholderTextColor={theme.text.tertiary}
                      style={{
                        backgroundColor: theme.boxBackgrounds.primary,
                        color: theme.text.primary,
                      }}
                    />
                  </FieldBlock>
                </HalfField>
              </TwoColumnRow>
            )}

            <FieldBlock>
              <Text size="small" bold style={{ marginBottom: 8 }}>
                {translate('auth.fields.email')}
              </Text>
              <FieldInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={translate('auth.placeholders.email')}
                placeholderTextColor={theme.text.tertiary}
                style={{
                  backgroundColor: theme.boxBackgrounds.primary,
                  color: theme.text.primary,
                }}
              />
            </FieldBlock>

            {mode === 'signUp' && (
              <FieldBlock>
                <Text size="small" bold style={{ marginBottom: 8 }}>
                  {translate('auth.fields.phone')}
                </Text>
                <FieldInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  placeholder={translate('auth.placeholders.phone')}
                  placeholderTextColor={theme.text.tertiary}
                  style={{
                    backgroundColor: theme.boxBackgrounds.primary,
                    color: theme.text.primary,
                  }}
                />
              </FieldBlock>
            )}

            <FieldBlock>
              <Text size="small" bold style={{ marginBottom: 8 }}>
                {translate('auth.fields.password')}
              </Text>
              <FieldInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={translate('auth.placeholders.password')}
                placeholderTextColor={theme.text.tertiary}
                style={{
                  backgroundColor: theme.boxBackgrounds.primary,
                  color: theme.text.primary,
                }}
              />
            </FieldBlock>

            {!!activeError && (
              <View
                style={{
                  marginTop: 6,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: rgba(COLORS.cottonCandyRed, 0.1),
                }}
              >
                <Text size="small" color={COLORS.cottonCandyRed}>
                  {activeError}
                </Text>
              </View>
            )}

            <ActionButton
              disabled={isBusy}
              onPress={handleSubmit}
              style={{
                backgroundColor:
                  mode === 'signIn' ? COLORS.amazingBlue : COLORS.gold,
                opacity: isBusy ? 0.7 : 1,
              }}
            >
              <Text bold color={mode === 'signIn' ? COLORS.white : theme.text.primary}>
                {ctaLabel}
              </Text>
            </ActionButton>

            <Footnote>
              <Text size="small" color={theme.text.tertiary}>
                {mode === 'signIn'
                  ? translate('auth.signIn.footer')
                  : translate('auth.signUp.footer')}
              </Text>
            </Footnote>
          </Panel>
        </Shell>
      </KeyboardAvoidingView>
    </Page>
  );
};

export default Auth;
