import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSelector } from 'react-redux';
import styled, { useTheme } from 'styled-components/native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { RootState, useAppDispatch } from '../../app/store';
import { SCREEN_NAMES } from '../../app/constants';
import { contextSelector } from '../../features/context/contextSelectors';
import { requestGetInquiries } from '../../features/inbox/inboxSlice';
import { requestUpdateBand } from '../../features/bands/bandsSlice';
import { requestUpdateVenue } from '../../features/venues/venuesSlice';
import { handleSignOut } from '../../features/auth/authSlice';
import { Page, Text } from '../../Generics';
import { COLORS, rgba } from '../../utils/colorUtils';
import { getFormattedCurrency } from '../../utils/localeUtils';
import useTranslation from '../../features/locale/useTranslation';

const Content = styled(ScrollView)`
  flex: 1;
  width: 100%;
  padding: 20px 0 28px;
`;

const Hero = styled.View`
  margin-bottom: 18px;
`;

const Panel = styled.View`
  width: 100%;
  padding: 18px;
  border-radius: 22px;
  margin-bottom: 14px;
`;

const ActionButton = styled(Pressable)`
  min-height: 52px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  margin-top: 18px;
`;

const SecondaryButton = styled(Pressable)`
  min-height: 52px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  border-width: 1px;
`;

const ToggleButton = styled(Pressable)`
  padding: 10px 14px;
  border-radius: 999px;
  align-items: center;
  justify-content: center;
`;

const NotesInput = styled(TextInput)`
  width: 100%;
  min-height: 110px;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 15px;
  text-align-vertical: top;
`;

const SaveButton = styled(Pressable)`
  min-height: 48px;
  padding: 0 16px;
  border-radius: 14px;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  align-self: flex-start;
`;

type Navigation = {
  navigate: (screen: string, params?: Record<string, string>) => void;
};

type BandEntity = RootState['bands']['entities']['bands'][string];
type VenueEntity = RootState['venues']['entities']['venues'][string];

const DEFAULT_LOCATION = {
  latitude: 59.3293,
  longitude: 18.0686,
};

const DEFAULT_ADDRESS = {
  street: '',
  city: '',
  zipCode: '',
  state: '',
  country: 'Sweden',
  location: DEFAULT_LOCATION,
};

const Profile = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Navigation>();
  const theme = useTheme();
  const translate = useTranslation();
  const { contextUser, contextDetails } = useSelector(contextSelector);
  const bandEntities = useSelector((state: RootState) => state.bands.entities.bands);
  const venueEntities = useSelector((state: RootState) => state.venues.entities.venues);

  const [bandNotesDrafts, setBandNotesDrafts] = useState<Record<string, string>>({});
  const [venueNotesDrafts, setVenueNotesDrafts] = useState<Record<string, string>>({});
  const [bandSearchingDrafts, setBandSearchingDrafts] = useState<Record<string, boolean>>({});
  const [venueSearchingDrafts, setVenueSearchingDrafts] = useState<Record<string, boolean>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      dispatch(requestGetInquiries());
    }, [dispatch]),
  );

  const userBands = useMemo(
    () =>
      (contextDetails?.bands ?? [])
        .map((bandRef: { id: string }) => bandEntities[bandRef.id])
        .filter(Boolean) as BandEntity[],
    [bandEntities, contextDetails?.bands],
  );

  const userVenues = useMemo(
    () =>
      (contextDetails?.venues ?? [])
        .map((venueRef: { id: string }) => venueEntities[venueRef.id])
        .filter(Boolean) as VenueEntity[],
    [contextDetails?.venues, venueEntities],
  );

  const bandCount = userBands.length;
  const venueCount = userVenues.length;
  const displayName = contextUser?.name ?? translate('profile.profile');

  function resolveBandAddress(band: BandEntity) {
    return {
      street: band.address?.street ?? DEFAULT_ADDRESS.street,
      city: band.address?.city ?? DEFAULT_ADDRESS.city,
      zipCode: band.address?.zipCode ?? DEFAULT_ADDRESS.zipCode,
      state: band.address?.state ?? DEFAULT_ADDRESS.state,
      country: band.address?.country ?? DEFAULT_ADDRESS.country,
      location: band.address?.location ?? DEFAULT_ADDRESS.location,
    };
  }

  function resolveVenueAddress(venue: VenueEntity) {
    return {
      street: venue.address?.street ?? DEFAULT_ADDRESS.street,
      city: venue.address?.city ?? DEFAULT_ADDRESS.city,
      zipCode: venue.address?.zipCode ?? DEFAULT_ADDRESS.zipCode,
      state: venue.address?.state ?? DEFAULT_ADDRESS.state,
      country: venue.address?.country ?? DEFAULT_ADDRESS.country,
      location: venue.address?.location ?? DEFAULT_ADDRESS.location,
    };
  }

  async function saveBandOpportunity(band: BandEntity) {
    const notes = bandNotesDrafts[band.id] ?? band.bookingNotes ?? '';
    const lookingForShows = bandSearchingDrafts[band.id] ?? !!band.lookingForShows;

    try {
      setSavingKey(`band-${band.id}`);
      await dispatch(
        requestUpdateBand({
          bandId: band.id,
          name: band.name,
          address: resolveBandAddress(band),
          price: band.price ?? { amount: 0, currency: 'SEK' },
          description: band.description ?? '',
          lookingForShows,
          bookingNotes: notes,
          songs: band.songs ?? [],
          images: band.images ?? band.imageUrls ?? [],
        }),
      );
      Alert.alert(
        translate('profile.matchmaking.successTitle'),
        translate('profile.matchmaking.bandSaved'),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate('profile.matchmaking.errorDescription');
      Alert.alert(translate('profile.matchmaking.errorTitle'), message);
    } finally {
      setSavingKey(null);
    }
  }

  async function saveVenueOpportunity(venue: VenueEntity) {
    const notes = venueNotesDrafts[venue.id] ?? venue.bookingNotes ?? '';
    const lookingForBands = venueSearchingDrafts[venue.id] ?? !!venue.lookingForBands;

    try {
      setSavingKey(`venue-${venue.id}`);
      await dispatch(
        requestUpdateVenue({
          venueId: venue.id,
          name: venue.name,
          address: resolveVenueAddress(venue),
          description: venue.description ?? '',
          lookingForBands,
          bookingNotes: notes,
          images: venue.images ?? venue.imageUrls ?? [],
        }),
      );
      Alert.alert(
        translate('profile.matchmaking.successTitle'),
        translate('profile.matchmaking.venueSaved'),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : translate('profile.matchmaking.errorDescription');
      Alert.alert(translate('profile.matchmaking.errorTitle'), message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Page safe>
      <Content showsVerticalScrollIndicator={false}>
        <Hero>
          <Text header size="small" bold color={COLORS.amazingBlue}>
            {translate('profile.profile')}
          </Text>
          <Text header size="giant" style={{ marginTop: 10 }}>
            {displayName}
          </Text>
          <Text size="small" color={theme.text.tertiary} style={{ marginTop: 10 }}>
            {contextUser?.email ?? translate('profile.authenticatedDescription')}
          </Text>
        </Hero>

        <Panel
          style={{
            backgroundColor: theme.boxBackgrounds.primary,
            borderWidth: 1,
            borderColor: rgba(COLORS.black, 0.08),
          }}
        >
          <Text header size="large">
            {translate('profile.accountStatus.title')}
          </Text>
          <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
            {translate('profile.accountStatus.description')}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: rgba(COLORS.amazingBlue, 0.12),
                marginRight: 10,
              }}
            >
              <Text size="small" bold color={COLORS.amazingBlue}>
                {translate('profile.accountStatus.bands', { amount: bandCount })}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: rgba(COLORS.gold, 0.18),
              }}
            >
              <Text size="small" bold>
                {translate('profile.accountStatus.venues', { amount: venueCount })}
              </Text>
            </View>
          </View>
        </Panel>

        {!bandCount && !venueCount && (
          <Panel
            style={{
              backgroundColor: rgba(COLORS.turquoise, 0.08),
              borderWidth: 1,
              borderColor: rgba(COLORS.turquoise, 0.24),
            }}
          >
            <Text header size="large">
              {translate('profile.nextStep.title')}
            </Text>
            <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
              {translate('profile.nextStep.description')}
            </Text>
          </Panel>
        )}

        <Panel
          style={{
            backgroundColor: theme.boxBackgrounds.primary,
            borderWidth: 1,
            borderColor: rgba(COLORS.black, 0.08),
          }}
        >
          <Text header size="large">
            {translate('profile.builders.title')}
          </Text>
          <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
            {translate('profile.builders.description')}
          </Text>

          <SecondaryButton
            onPress={() => navigation.navigate(SCREEN_NAMES.CREATE_BAND)}
            style={{
              marginTop: 18,
              backgroundColor: rgba(COLORS.amazingBlue, 0.08),
              borderColor: rgba(COLORS.amazingBlue, 0.28),
            }}
          >
            <Text bold color={COLORS.amazingBlue}>
              {bandCount
                ? translate('profile.builders.addBand')
                : translate('profile.builders.createBand')}
            </Text>
          </SecondaryButton>

          <SecondaryButton
            onPress={() => navigation.navigate(SCREEN_NAMES.CREATE_VENUE)}
            style={{
              backgroundColor: rgba(COLORS.gold, 0.12),
              borderColor: rgba(COLORS.gold, 0.34),
            }}
          >
            <Text bold>
              {venueCount
                ? translate('profile.builders.addVenue')
                : translate('profile.builders.createVenue')}
            </Text>
            </SecondaryButton>
          </Panel>

        <Panel
          style={{
            backgroundColor: theme.boxBackgrounds.primary,
            borderWidth: 1,
            borderColor: rgba(COLORS.black, 0.08),
          }}
        >
          <Text header size="large">
            {translate('profile.inbox.title')}
          </Text>
          <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
            {translate('profile.inbox.description')}
          </Text>

          <SecondaryButton
            onPress={() => navigation.navigate(SCREEN_NAMES.BOOKING_INBOX)}
            style={{
              marginTop: 18,
              backgroundColor: rgba(COLORS.amazingBlue, 0.08),
              borderColor: rgba(COLORS.amazingBlue, 0.28),
            }}
          >
            <Text bold color={COLORS.amazingBlue}>
              {translate('profile.inbox.cta')}
            </Text>
          </SecondaryButton>
        </Panel>

        {!!userBands.length && (
          <Panel
            style={{
              backgroundColor: theme.boxBackgrounds.primary,
              borderWidth: 1,
              borderColor: rgba(COLORS.black, 0.08),
            }}
          >
            <Text header size="large">
              {translate('profile.matchmaking.bandSectionTitle')}
            </Text>
            <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
              {translate('profile.matchmaking.bandSectionDescription')}
            </Text>

            {userBands.map((band) => {
              const isSearching = bandSearchingDrafts[band.id] ?? !!band.lookingForShows;
              const notes = bandNotesDrafts[band.id] ?? band.bookingNotes ?? '';
              const isSaving = savingKey === `band-${band.id}`;

              return (
                <View
                  key={band.id}
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: rgba(COLORS.black, 0.08),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text header size="increased">
                      {band.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate(SCREEN_NAMES.EDIT_BAND, {
                          id: band.id,
                          name: band.name,
                          description: band.description,
                          street: band.address?.street,
                          city: band.address?.city,
                          zipCode: band.address?.zipCode,
                          state: band.address?.state,
                          country: band.address?.country,
                          priceAmount: band.price?.amount,
                          lookingForShows: isSearching,
                          bookingNotes: notes,
                        } as any)
                      }
                    >
                      <Text size="small" bold color={COLORS.amazingBlue}>Edit</Text>
                    </Pressable>
                  </View>
                  {!!band.price && (
                    <Text size="small" bold style={{ marginTop: 6 }}>
                      {getFormattedCurrency(band.price.amount, band.price.currency, true)}
                    </Text>
                  )}
                  <Text size="small" color={theme.text.tertiary} style={{ marginTop: 6 }}>
                    {translate('profile.matchmaking.bandCardDescription')}
                  </Text>

                  <ToggleButton
                    onPress={() =>
                      setBandSearchingDrafts((current) => ({
                        ...current,
                        [band.id]: !isSearching,
                      }))
                    }
                    style={{
                      marginTop: 12,
                      backgroundColor: isSearching ? rgba(COLORS.amazingBlue, 0.14) : rgba(COLORS.black, 0.05),
                    }}
                  >
                    <Text bold color={isSearching ? COLORS.amazingBlue : theme.text.primary}>
                      {isSearching
                        ? translate('profile.matchmaking.bandToggleOn')
                        : translate('profile.matchmaking.bandToggleOff')}
                    </Text>
                  </ToggleButton>

                  <Text size="small" bold style={{ marginTop: 14, marginBottom: 8 }}>
                    {translate('profile.matchmaking.notesLabel')}
                  </Text>
                  <NotesInput
                    multiline
                    value={notes}
                    onChangeText={(value) =>
                      setBandNotesDrafts((current) => ({ ...current, [band.id]: value }))
                    }
                    placeholder={translate('profile.matchmaking.bandNotesPlaceholder')}
                    placeholderTextColor={theme.text.tertiary}
                    style={{
                      backgroundColor: theme.boxBackgrounds.tertiary,
                      color: theme.text.primary,
                    }}
                  />

                  <SaveButton
                    onPress={() => saveBandOpportunity(band)}
                    style={{
                      backgroundColor: COLORS.amazingBlue,
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    <Text bold color={COLORS.white}>
                      {isSaving
                        ? translate('profile.matchmaking.saving')
                        : translate('profile.matchmaking.saveBand')}
                    </Text>
                  </SaveButton>
                </View>
              );
            })}
          </Panel>
        )}

        {!!userVenues.length && (
          <Panel
            style={{
              backgroundColor: theme.boxBackgrounds.primary,
              borderWidth: 1,
              borderColor: rgba(COLORS.black, 0.08),
            }}
          >
            <Text header size="large">
              {translate('profile.matchmaking.venueSectionTitle')}
            </Text>
            <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>
              {translate('profile.matchmaking.venueSectionDescription')}
            </Text>

            <SecondaryButton
              onPress={() =>
                navigation.navigate(SCREEN_NAMES.CREATE_SHOW, {
                  preferredMode: 'single',
                })
              }
              style={{
                marginTop: 18,
                backgroundColor: rgba(COLORS.amazingBlue, 0.08),
                borderColor: rgba(COLORS.amazingBlue, 0.28),
              }}
            >
              <Text bold color={COLORS.amazingBlue}>
                {translate('profile.planner.createShow')}
              </Text>
            </SecondaryButton>

            <SecondaryButton
              onPress={() =>
                navigation.navigate(SCREEN_NAMES.CREATE_SHOW, {
                  preferredMode: 'festival',
                })
              }
              style={{
                backgroundColor: rgba(COLORS.gold, 0.12),
                borderColor: rgba(COLORS.gold, 0.34),
              }}
            >
              <Text bold>{translate('profile.planner.createFestival')}</Text>
            </SecondaryButton>

            {userVenues.map((venue) => {
              const isSearching = venueSearchingDrafts[venue.id] ?? !!venue.lookingForBands;
              const notes = venueNotesDrafts[venue.id] ?? venue.bookingNotes ?? '';
              const isSaving = savingKey === `venue-${venue.id}`;

              return (
                <View
                  key={venue.id}
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: rgba(COLORS.black, 0.08),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text header size="increased">
                      {venue.name}
                    </Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate(SCREEN_NAMES.EDIT_VENUE, {
                          id: venue.id,
                          name: venue.name,
                          description: venue.description,
                          street: venue.address?.street,
                          city: venue.address?.city,
                          zipCode: venue.address?.zipCode,
                          state: venue.address?.state,
                          country: venue.address?.country,
                          lookingForBands: isSearching,
                          bookingNotes: notes,
                        } as any)
                      }
                    >
                      <Text size="small" bold color={COLORS.gold}>Edit</Text>
                    </Pressable>
                  </View>
                  <Text size="small" color={theme.text.tertiary} style={{ marginTop: 6 }}>
                    {translate('profile.matchmaking.venueCardDescription')}
                  </Text>

                  <ToggleButton
                    onPress={() =>
                      setVenueSearchingDrafts((current) => ({
                        ...current,
                        [venue.id]: !isSearching,
                      }))
                    }
                    style={{
                      marginTop: 12,
                      backgroundColor: isSearching ? rgba(COLORS.gold, 0.18) : rgba(COLORS.black, 0.05),
                    }}
                  >
                    <Text bold color={theme.text.primary}>
                      {isSearching
                        ? translate('profile.matchmaking.venueToggleOn')
                        : translate('profile.matchmaking.venueToggleOff')}
                    </Text>
                  </ToggleButton>

                  <Text size="small" bold style={{ marginTop: 14, marginBottom: 8 }}>
                    {translate('profile.matchmaking.notesLabel')}
                  </Text>
                  <NotesInput
                    multiline
                    value={notes}
                    onChangeText={(value) =>
                      setVenueNotesDrafts((current) => ({ ...current, [venue.id]: value }))
                    }
                    placeholder={translate('profile.matchmaking.venueNotesPlaceholder')}
                    placeholderTextColor={theme.text.tertiary}
                    style={{
                      backgroundColor: theme.boxBackgrounds.tertiary,
                      color: theme.text.primary,
                    }}
                  />

                  <SaveButton
                    onPress={() => saveVenueOpportunity(venue)}
                    style={{
                      backgroundColor: COLORS.gold,
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    <Text bold color={theme.text.primary}>
                      {isSaving
                        ? translate('profile.matchmaking.saving')
                        : translate('profile.matchmaking.saveVenue')}
                    </Text>
                  </SaveButton>
                </View>
              );
            })}
          </Panel>
        )}

        <ActionButton
          onPress={() => dispatch(handleSignOut())}
          style={{ backgroundColor: COLORS.black }}
        >
          <Text bold color={COLORS.white}>
            {translate('profile.signOut')}
          </Text>
        </ActionButton>
      </Content>
    </Page>
  );
};

export default Profile;
