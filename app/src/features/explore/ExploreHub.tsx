import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
} from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import * as api from '../../api';
import { USER_TYPES } from '../../app/constants';
import { Spinner } from '../../components';
import { Image, Text } from '../../Generics';
import { appendBookingInboxItem } from '../inbox/bookingInboxStorage';
import { COLORS, rgba } from '../../utils/colorUtils';
import { formatDateTime } from '../../utils/dateUtils';
import { getFormattedCurrency } from '../../utils/localeUtils';
import { formatNumberToKm } from '../../utils/stringUtils';
import useTranslation from '../locale/useTranslation';

const ScreenContent = styled.View`
  padding: 10px 10px 36px;
`;
const Hero = styled.View`
  padding: 24px 20px;
  border-radius: 30px;
  margin-bottom: 22px;
`;
const HeroHighlights = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 14px;
`;
const HeroHighlight = styled.View`
  padding: 10px 12px;
  border-radius: 999px;
  margin-right: 8px;
  margin-bottom: 8px;
`;
const AudienceOptions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 12px;
`;
const AudienceChip = styled.View`
  padding: 10px 14px;
  border-radius: 999px;
  margin-right: 8px;
  margin-bottom: 8px;
`;
const StatsRow = styled.View`
  flex-direction: row;
  margin-top: 18px;
`;
const StatPill = styled.View`
  flex: 1;
  padding: 12px 14px;
  border-radius: 18px;
  margin-right: 8px;
`;
const Section = styled.View`
  margin-bottom: 28px;
`;
const SectionHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 14px;
`;
const SectionHeaderContent = styled.View`
  flex: 1;
  padding-right: 12px;
`;
const SectionCount = styled.View`
  min-width: 36px;
  padding: 8px 10px;
  border-radius: 999px;
  align-items: center;
`;
const HorizontalList = styled.ScrollView`
  margin-right: -10px;
`;
const FeaturedCard = styled.View`
  width: 290px;
  height: 320px;
  margin-right: 14px;
  border-radius: 28px;
  overflow: hidden;
  justify-content: flex-end;
`;
const FeaturedOverlay = styled.View`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;
const FeaturedContent = styled.View`
  padding: 18px;
`;
const DirectoryCard = styled.View`
  width: 220px;
  margin-right: 14px;
`;
const DirectoryMedia = styled.View`
  height: 150px;
  border-radius: 24px;
  overflow: hidden;
  justify-content: flex-end;
`;
const DirectoryBody = styled.View`
  padding: 12px 4px 0;
`;
const PlaceholderMedia = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 18px;
`;
const CompactShowCard = styled.View`
  padding: 16px;
  border-radius: 22px;
  margin-bottom: 12px;
`;
const MatchCard = styled.View`
  width: 268px;
  margin-right: 14px;
  border-radius: 24px;
  overflow: hidden;
`;
const MatchCardBody = styled.View`
  padding: 16px;
`;
const MatchMeta = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-top: 10px;
`;
const MatchMetaPill = styled.View`
  padding: 8px 10px;
  border-radius: 999px;
  margin-right: 8px;
  margin-bottom: 8px;
`;
const MatchPrimaryAction = styled.Pressable`
  margin-top: 14px;
  border-radius: 16px;
  padding: 12px 14px;
  align-items: center;
`;
const MatchEmptyState = styled.View`
  padding: 18px;
  border-radius: 22px;
`;
const EmptyLoading = styled.View`
  min-height: 320px;
  align-items: center;
  justify-content: center;
`;
const ModalBackdrop = styled.View`
  flex: 1;
  background-color: rgba(10, 15, 13, 0.48);
  justify-content: flex-end;
`;
const ModalCard = styled.View`
  border-top-left-radius: 28px;
  border-top-right-radius: 28px;
  padding: 22px 18px 28px;
`;
const FieldLabel = styled(Text)`
  margin-bottom: 8px;
  margin-top: 14px;
`;
const Input = styled(TextInput)`
  min-height: 48px;
  border-radius: 16px;
  padding: 13px 14px;
`;
const MultilineInput = styled(TextInput)`
  min-height: 120px;
  border-radius: 16px;
  padding: 14px;
  text-align-vertical: top;
`;
const ModalActions = styled.View`
  flex-direction: row;
  margin-top: 18px;
`;
const ModalButton = styled.Pressable`
  flex: 1;
  min-height: 48px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
`;

type RequesterProfile = {
  userType?: number;
  requesterId?: string;
  name?: string;
  email?: string;
};
type ExploreHubProps = {
  shows: any[];
  bands: any[];
  venues: any[];
  isLoading: boolean;
  audienceMode: number;
  requesterProfile?: RequesterProfile;
  onAudienceModeChange: (mode: number) => void;
  onShowPress: (id: string) => void;
  onBandPress: (id: string) => void;
  onVenuePress: (id: string) => void;
  onRefresh: () => void;
};
type InquiryTarget = {
  id: string;
  name: string;
  bookingNotes?: string;
  description?: string;
  address?: any;
  relatedShow?: any;
  targetType: number;
  inquiryType: 'venue' | 'band';
  imageUrl?: string;
  imageUrls?: string[];
  images?: string[];
};

const getImage = (item: any) => item?.imageUrls?.[0] ?? item?.images?.[0] ?? item?.imageUrl ?? null;
const getAddressLine = (item: any) => {
  const address = item?.address;
  if (!address) return null;
  return [address.city, address.state].filter(Boolean).join(', ');
};
const getDistance = (show: any) => show?.distanceInKm ?? show?.distanceKm ?? null;
const getInitials = (value = '') => value.split(' ').filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
const getPriceLabel = (item: any) => {
  if (item?.price?.amount === undefined || item?.price?.amount === null) {
    return null;
  }

  return getFormattedCurrency(item.price.amount, item.price.currency, true);
};

function DirectoryRail({ items, accent, onPress, typeLabel }: { items: any[]; accent: string; onPress: (id: string) => void; typeLabel: string; }) {
  const theme = useTheme();
  return (
    <HorizontalList horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const image = getImage(item);
        const priceLabel = getPriceLabel(item);
        return (
          <DirectoryCard key={item.id}>
            <Pressable onPress={() => onPress(item.id)}>
              <DirectoryMedia style={{ backgroundColor: rgba(accent, 0.12), borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}>
                {image ? <Image uri={image} /> : <PlaceholderMedia><Text header size="huge" color={accent}>{getInitials(item.name)}</Text></PlaceholderMedia>}
              </DirectoryMedia>
              <DirectoryBody>
                <Text size="small" bold color={accent}>{typeLabel}</Text>
                <Text header size="increased" style={{ marginTop: 4 }}>{item.name}</Text>
                {!!priceLabel && <Text size="small" bold style={{ marginTop: 6 }}>{priceLabel}</Text>}
                {!!getAddressLine(item) && <Text size="small" color={theme.text.tertiary} style={{ marginTop: 6 }}>{getAddressLine(item)}</Text>}
              </DirectoryBody>
            </Pressable>
          </DirectoryCard>
        );
      })}
    </HorizontalList>
  );
}

function MatchRail({ items, onPress, onActionPress, accent, type }: { items: InquiryTarget[]; onPress: (id: string) => void; onActionPress: (item: InquiryTarget) => void; accent: string; type: 'venue' | 'band'; }) {
  const theme = useTheme();
  const translate = useTranslation();
  return (
    <HorizontalList horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => {
        const image = getImage(item);
        const priceLabel = getPriceLabel(item);
        const description = item.bookingNotes || item.description || (type === 'venue' ? translate('explore.matchmaking.bandFallback') : translate('explore.matchmaking.venueFallback'));
        return (
          <MatchCard key={item.id} style={{ backgroundColor: theme.boxBackgrounds.tertiary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}>
            <Pressable onPress={() => onPress(item.id)}>
              <DirectoryMedia style={{ height: 160, backgroundColor: rgba(accent, 0.12) }}>
                {image ? <Image uri={image} /> : <PlaceholderMedia><Text header size="huge" color={accent}>{getInitials(item.name)}</Text></PlaceholderMedia>}
              </DirectoryMedia>
            </Pressable>
            <MatchCardBody>
              <Text size="small" bold color={accent}>{type === 'venue' ? translate('explore.matchmaking.venueBadge') : translate('explore.matchmaking.bandBadge')}</Text>
              <Pressable onPress={() => onPress(item.id)}><Text header size="increased" style={{ marginTop: 6 }}>{item.name}</Text></Pressable>
              <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>{description}</Text>
              <MatchMeta>
                {!!priceLabel && <MatchMetaPill style={{ backgroundColor: rgba(accent, 0.12) }}><Text size="small" bold color={accent}>{priceLabel}</Text></MatchMetaPill>}
                <MatchMetaPill style={{ backgroundColor: rgba(accent, 0.12) }}><Text size="small" bold color={accent}>{getAddressLine(item) || 'Stockholm'}</Text></MatchMetaPill>
                {!!item.relatedShow && <MatchMetaPill style={{ backgroundColor: rgba(COLORS.black, 0.05) }}><Text size="small" bold color={theme.text.tertiary}>{item.relatedShow.name}</Text></MatchMetaPill>}
              </MatchMeta>
              <MatchPrimaryAction onPress={() => onActionPress(item)} style={{ backgroundColor: accent }}><Text size="small" bold color={COLORS.white}>{type === 'venue' ? translate('explore.inquiry.bandAction') : translate('explore.inquiry.venueAction')}</Text></MatchPrimaryAction>
            </MatchCardBody>
          </MatchCard>
        );
      })}
    </HorizontalList>
  );
}

export default function ExploreHub({ shows, bands, venues, isLoading, audienceMode, requesterProfile, onAudienceModeChange, onShowPress, onBandPress, onVenuePress, onRefresh }: ExploreHubProps) {
  const theme = useTheme();
  const translate = useTranslation();
  const [activeInquiry, setActiveInquiry] = useState<InquiryTarget | null>(null);
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);
  const [inquiryName, setInquiryName] = useState(requesterProfile?.name ?? '');
  const [inquiryEmail, setInquiryEmail] = useState(requesterProfile?.email ?? '');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');

  const featuredShows = shows.slice(0, 3);
  const nearbyShows = shows.slice(0, 6);
  const audienceModes = [
    { id: USER_TYPES.visitor, label: translate('explore.audience.visitor') },
    { id: USER_TYPES.band, label: translate('explore.audience.band') },
    { id: USER_TYPES.venue, label: translate('explore.audience.venue') },
  ];
  const venueOpportunities = useMemo(() => venues.filter((venue) => venue?.lookingForBands).map((venue) => ({ ...venue, relatedShow: shows.find((show) => show.venue?.id === venue.id) ?? null, targetType: USER_TYPES.venue, inquiryType: 'venue' as const })), [shows, venues]);
  const bandOpportunities = useMemo(() => bands.filter((band) => band?.lookingForShows).map((band) => ({ ...band, relatedShow: null, targetType: USER_TYPES.band, inquiryType: 'band' as const })), [bands]);

  function openInquiryModal(item: InquiryTarget) {
    setActiveInquiry(item);
    setInquiryName(requesterProfile?.name ?? '');
    setInquiryEmail(requesterProfile?.email ?? '');
    setInquiryPhone('');
    setInquiryMessage(item.inquiryType === 'venue' ? translate('explore.inquiry.defaultBandMessage', { targetName: item.name }) : translate('explore.inquiry.defaultVenueMessage', { targetName: item.name }));
  }
  function closeInquiryModal() { setActiveInquiry(null); setInquiryPhone(''); }
  async function submitInquiry() {
    if (!activeInquiry) return;
    if (!inquiryName.trim() || !inquiryEmail.trim() || !inquiryMessage.trim()) {
      Alert.alert(translate('explore.inquiry.validationTitle'), translate('explore.inquiry.validationDescription'));
      return;
    }
    setIsSubmittingInquiry(true);
    try {
      await api.matchmaking.post.inquiry({ requesterType: requesterProfile?.userType ?? audienceMode, requesterId: requesterProfile?.requesterId, requesterName: inquiryName.trim(), requesterEmail: inquiryEmail.trim(), requesterPhone: inquiryPhone.trim() || null, message: inquiryMessage.trim(), targetType: activeInquiry.targetType, targetId: activeInquiry.id, targetName: activeInquiry.name });
      void appendBookingInboxItem({
        id: `local-${Date.now()}`,
        direction: 'outgoing',
        status: 'new',
        read: false,
        source: 'local',
        requesterRole: activeInquiry.inquiryType === 'venue' ? 'band' : 'venue',
        targetRole: activeInquiry.inquiryType === 'venue' ? 'venue' : 'band',
        requesterId: requesterProfile?.requesterId,
        requesterName: inquiryName.trim(),
        requesterEmail: inquiryEmail.trim(),
        requesterPhone: inquiryPhone.trim() || undefined,
        targetName: activeInquiry.name,
        targetId: activeInquiry.id,
        message: inquiryMessage.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch(() => null);
      closeInquiryModal();
      Alert.alert(translate('explore.inquiry.successTitle'), translate('explore.inquiry.successDescription', { targetName: activeInquiry.name }));
    } catch (_error) {
      Alert.alert(translate('explore.inquiry.errorTitle'), translate('explore.inquiry.errorDescription'));
    } finally {
      setIsSubmittingInquiry(false);
    }
  }

  if (isLoading && shows.length === 0 && bands.length === 0 && venues.length === 0) {
    return <EmptyLoading><Spinner /></EmptyLoading>;
  }

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}>
        <ScreenContent>
          <Hero style={{ backgroundColor: theme.boxBackgrounds.tertiary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}>
            <Text size="small" bold color={theme.text.tertiary}>{translate('explore.intro.eyebrow')}</Text>
            <Text header size="huge" style={{ marginTop: 10 }}>{translate('explore.intro.title')}</Text>
            <Text size="reduced" color={theme.text.tertiary} style={{ marginTop: 12 }}>{translate('explore.intro.description')}</Text>
            <HeroHighlights>
              <HeroHighlight style={{ backgroundColor: rgba(COLORS.amazingBlue, 0.1) }}><Text size="small" bold color={COLORS.amazingBlue}>Nya kvallar att upptacka</Text></HeroHighlight>
              <HeroHighlight style={{ backgroundColor: rgba(COLORS.turquoise, 0.12) }}><Text size="small" bold color={COLORS.turquoise}>Matchning mellan akter och scener</Text></HeroHighlight>
            </HeroHighlights>
            <AudienceOptions>
              {audienceModes.map((mode) => {
                const isActive = mode.id === audienceMode;
                return <Pressable key={mode.id} onPress={() => onAudienceModeChange(mode.id)}><AudienceChip style={{ backgroundColor: isActive ? theme.backgrounds.secondary : rgba(COLORS.black, 0.06) }}><Text size="small" bold color={isActive ? theme.text.secondary : theme.text.primary}>{mode.label}</Text></AudienceChip></Pressable>;
              })}
            </AudienceOptions>
            <StatsRow>
              <StatPill style={{ backgroundColor: rgba(COLORS.amazingBlue, 0.1) }}><Text header size="large">{String(shows.length)}</Text><Text size="small" color={theme.text.tertiary}>{translate('explore.intro.stats.shows')}</Text></StatPill>
              <StatPill style={{ backgroundColor: rgba(COLORS.turquoise, 0.12) }}><Text header size="large">{String(bands.length)}</Text><Text size="small" color={theme.text.tertiary}>{translate('explore.intro.stats.artists')}</Text></StatPill>
              <StatPill style={{ backgroundColor: rgba(COLORS.gold, 0.16), marginRight: 0 }}><Text header size="large">{String(venues.length)}</Text><Text size="small" color={theme.text.tertiary}>{translate('explore.intro.stats.venues')}</Text></StatPill>
            </StatsRow>
          </Hero>

          {audienceMode === USER_TYPES.band && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.matchmaking.bandTitle')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.matchmaking.bandDescription')}</Text></SectionHeaderContent><SectionCount style={{ backgroundColor: rgba(COLORS.gold, 0.16) }}><Text size="small" bold>{String(venueOpportunities.length)}</Text></SectionCount></SectionHeader>{venueOpportunities.length ? <MatchRail items={venueOpportunities} onPress={onVenuePress} onActionPress={openInquiryModal} accent={COLORS.gold} type="venue" /> : <MatchEmptyState style={{ backgroundColor: theme.boxBackgrounds.tertiary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}><Text header size="increased">{translate('explore.matchmaking.noVenueMatchesTitle')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>{translate('explore.matchmaking.noVenueMatchesDescription')}</Text></MatchEmptyState>}</Section>}
          {audienceMode === USER_TYPES.venue && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.matchmaking.venueTitle')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.matchmaking.venueDescription')}</Text></SectionHeaderContent><SectionCount style={{ backgroundColor: rgba(COLORS.amazingBlue, 0.1) }}><Text size="small" bold color={COLORS.amazingBlue}>{String(bandOpportunities.length)}</Text></SectionCount></SectionHeader>{bandOpportunities.length ? <MatchRail items={bandOpportunities} onPress={onBandPress} onActionPress={openInquiryModal} accent={COLORS.amazingBlue} type="band" /> : <MatchEmptyState style={{ backgroundColor: theme.boxBackgrounds.tertiary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}><Text header size="increased">{translate('explore.matchmaking.noBandMatchesTitle')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>{translate('explore.matchmaking.noBandMatchesDescription')}</Text></MatchEmptyState>}</Section>}

          {!!featuredShows.length && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.sections.featured.title')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.sections.featured.description')}</Text></SectionHeaderContent></SectionHeader><HorizontalList horizontal showsHorizontalScrollIndicator={false}>{featuredShows.map((show) => { const image = getImage(show); const distance = getDistance(show); const { day, date } = formatDateTime(show.date, true); return <Pressable key={show.id} onPress={() => onShowPress(show.id)}><FeaturedCard>{image ? <Image uri={image} /> : <PlaceholderMedia style={{ backgroundColor: rgba(COLORS.amazingBlue, 0.18) }}><Text header size="large" center>{show.name}</Text></PlaceholderMedia>}<FeaturedOverlay style={{ backgroundColor: 'rgba(10, 15, 13, 0.42)' }} /><FeaturedContent><Text header size="large" color={COLORS.white}>{show.name}</Text><Text size="small" color={rgba(COLORS.white, 0.9)} style={{ marginTop: 8 }}>{[day, date].filter(Boolean).join(' ')}</Text><Text size="small" color={rgba(COLORS.white, 0.9)} style={{ marginTop: 4 }}>{distance ? formatNumberToKm(distance, 1) : show.venue?.name}</Text></FeaturedContent></FeaturedCard></Pressable>; })}</HorizontalList></Section>}
          {!!nearbyShows.length && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.sections.shows.title')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.sections.shows.description')}</Text></SectionHeaderContent></SectionHeader>{nearbyShows.map((show) => { const { day, date } = formatDateTime(show.date, true); const distance = getDistance(show); const venueLine = [show.venue?.name, distance ? formatNumberToKm(distance, 1) : null].filter(Boolean).join(' - '); return <Pressable key={show.id} onPress={() => onShowPress(show.id)}><CompactShowCard style={{ backgroundColor: theme.boxBackgrounds.tertiary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }}><Text header size="increased">{show.name}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>{[day, date].filter(Boolean).join(' ')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{venueLine}</Text></CompactShowCard></Pressable>; })}</Section>}
          {!!venues.length && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.sections.venues.title')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.sections.venues.description')}</Text></SectionHeaderContent></SectionHeader><DirectoryRail items={venues} accent={COLORS.gold} onPress={onVenuePress} typeLabel={translate('explore.labels.venue')} /></Section>}
          {!!bands.length && <Section><SectionHeader><SectionHeaderContent><Text header size="larger">{translate('explore.sections.bands.title')}</Text><Text size="small" color={theme.text.tertiary} style={{ marginTop: 4 }}>{translate('explore.sections.bands.description')}</Text></SectionHeaderContent></SectionHeader><DirectoryRail items={bands} accent={COLORS.amazingBlue} onPress={onBandPress} typeLabel={translate('explore.labels.band')} /></Section>}
        </ScreenContent>
      </ScrollView>

      <Modal visible={!!activeInquiry} animationType="slide" transparent onRequestClose={closeInquiryModal}>
        <ModalBackdrop>
          <Pressable style={{ flex: 1 }} onPress={closeInquiryModal} />
          <ModalCard style={{ backgroundColor: theme.backgrounds.primary }}>
            <Text header size="large">{activeInquiry?.inquiryType === 'venue' ? translate('explore.inquiry.bandTitle', { targetName: activeInquiry?.name }) : translate('explore.inquiry.venueTitle', { targetName: activeInquiry?.name })}</Text>
            <Text size="small" color={theme.text.tertiary} style={{ marginTop: 8 }}>{activeInquiry?.inquiryType === 'venue' ? translate('explore.inquiry.bandDescription') : translate('explore.inquiry.venueDescription')}</Text>
            <FieldLabel size="small" bold>{translate('explore.inquiry.nameLabel')}</FieldLabel>
            <Input value={inquiryName} onChangeText={setInquiryName} placeholder={translate('explore.inquiry.namePlaceholder')} placeholderTextColor={theme.text.tertiary} style={{ backgroundColor: theme.boxBackgrounds.tertiary, color: theme.text.primary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }} />
            <FieldLabel size="small" bold>{translate('explore.inquiry.emailLabel')}</FieldLabel>
            <Input value={inquiryEmail} onChangeText={setInquiryEmail} placeholder={translate('explore.inquiry.emailPlaceholder')} placeholderTextColor={theme.text.tertiary} keyboardType="email-address" autoCapitalize="none" style={{ backgroundColor: theme.boxBackgrounds.tertiary, color: theme.text.primary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }} />
            <FieldLabel size="small" bold>{translate('explore.inquiry.phoneLabel')}</FieldLabel>
            <Input value={inquiryPhone} onChangeText={setInquiryPhone} placeholder={translate('explore.inquiry.phonePlaceholder')} placeholderTextColor={theme.text.tertiary} keyboardType="phone-pad" style={{ backgroundColor: theme.boxBackgrounds.tertiary, color: theme.text.primary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }} />
            <FieldLabel size="small" bold>{translate('explore.inquiry.messageLabel')}</FieldLabel>
            <MultilineInput value={inquiryMessage} onChangeText={setInquiryMessage} multiline placeholder={translate('explore.inquiry.messagePlaceholder')} placeholderTextColor={theme.text.tertiary} style={{ backgroundColor: theme.boxBackgrounds.tertiary, color: theme.text.primary, borderWidth: 1, borderColor: rgba(COLORS.black, 0.08) }} />
            <ModalActions>
              <ModalButton onPress={closeInquiryModal} style={{ backgroundColor: rgba(COLORS.black, 0.06), marginRight: 8 }}><Text size="small" bold>{translate('common.cancel')}</Text></ModalButton>
              <ModalButton onPress={submitInquiry} disabled={isSubmittingInquiry} style={{ backgroundColor: activeInquiry?.inquiryType === 'venue' ? COLORS.gold : COLORS.amazingBlue, opacity: isSubmittingInquiry ? 0.7 : 1 }}><Text size="small" bold color={COLORS.white}>{isSubmittingInquiry ? translate('explore.inquiry.submitting') : translate('explore.inquiry.submit')}</Text></ModalButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      </Modal>
    </>
  );
}
