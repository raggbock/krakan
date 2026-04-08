import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/lib/auth-context';
import {
  api,
  type FleaMarketDetails,
  type MarketTable,
} from '@/lib/api';
import { colors } from '@/constants/Colors';

const DAY_NAMES = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [market, setMarket] = useState<FleaMarketDetails | null>(null);
  const [tables, setTables] = useState<MarketTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingTableId, setBookingTableId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [marketData, tablesData] = await Promise.all([
        api.fleaMarkets.details(id),
        api.marketTables.list(id),
      ]);
      setMarket(marketData);
      setTables(tablesData);
    } catch (err) {
      console.error('Failed to fetch market:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBook = useCallback(
    async (table: MarketTable) => {
      if (!user || !market) {
        Alert.alert('Logga in', 'Du måste vara inloggad för att boka.');
        return;
      }

      Alert.alert(
        'Boka bord',
        `Boka "${table.label}" för ${table.price_sek} kr?`,
        [
          { text: 'Avbryt', style: 'cancel' },
          {
            text: 'Boka',
            onPress: async () => {
              setBookingTableId(table.id);
              setBookingLoading(true);
              try {
                const today = new Date().toISOString().split('T')[0];
                await api.bookings.create({
                  marketTableId: table.id,
                  fleaMarketId: market.id,
                  bookedBy: user.id,
                  bookingDate: today,
                  priceSek: table.price_sek,
                });
                Alert.alert('Bokad!', 'Din bokning har skickats.');
              } catch (err: any) {
                Alert.alert('Fel', err?.message ?? 'Kunde inte boka. Försök igen.');
              } finally {
                setBookingLoading(false);
                setBookingTableId(null);
              }
            },
          },
        ],
      );
    },
    [user, market],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.rust} />
      </View>
    );
  }

  if (!market) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Loppisen hittades inte</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{market.name}</Text>
          <View
            style={[
              styles.badge,
              market.is_permanent ? styles.badgePermanent : styles.badgeTemporary,
            ]}
          >
            <Text style={styles.badgeText}>
              {market.is_permanent ? 'Permanent' : 'Tillfällig'}
            </Text>
          </View>
        </View>

        {market.organizerName ? (
          <View style={styles.infoRow}>
            <FontAwesome name="user" size={14} color="rgba(62,44,35,0.4)" />
            <Text style={styles.infoText}>{market.organizerName}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <FontAwesome name="map-marker" size={16} color="rgba(62,44,35,0.4)" />
          <Text style={styles.infoText}>
            {market.street}, {market.zip_code} {market.city}
          </Text>
        </View>
      </View>

      {/* Description */}
      {market.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Beskrivning</Text>
          <Text style={styles.description}>{market.description}</Text>
        </View>
      ) : null}

      {/* Opening hours */}
      {market.opening_hours && market.opening_hours.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Öppettider</Text>
          {market.opening_hours.map((oh) => (
            <View key={oh.id} style={styles.hoursRow}>
              <Text style={styles.hoursDay}>
                {oh.day_of_week != null
                  ? DAY_NAMES[oh.day_of_week] ?? `Dag ${oh.day_of_week}`
                  : oh.date ?? ''}
              </Text>
              <Text style={styles.hoursTime}>
                {oh.open_time.slice(0, 5)} – {oh.close_time.slice(0, 5)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Tables */}
      {tables.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bokningsbara bord</Text>
          {tables.map((table) => (
            <View key={table.id} style={styles.tableCard}>
              <View style={styles.tableInfo}>
                <Text style={styles.tableLabel}>{table.label}</Text>
                {table.size_description ? (
                  <Text style={styles.tableMeta}>{table.size_description}</Text>
                ) : null}
                {table.description ? (
                  <Text style={styles.tableMeta}>{table.description}</Text>
                ) : null}
                <Text style={styles.tablePrice}>{table.price_sek} kr</Text>
              </View>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => handleBook(table)}
                disabled={bookingLoading && bookingTableId === table.id}
              >
                {bookingLoading && bookingTableId === table.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.bookButtonText}>Boka</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.parchment,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(62,44,35,0.5)',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.espresso,
    flex: 1,
    marginRight: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  badgePermanent: {
    backgroundColor: colors.rust,
  },
  badgeTemporary: {
    backgroundColor: colors.mustard,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 15,
    color: 'rgba(62,44,35,0.6)',
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.espresso,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: colors.espresso,
    lineHeight: 22,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.creamWarm,
  },
  hoursDay: {
    fontSize: 15,
    color: colors.espresso,
  },
  hoursTime: {
    fontSize: 15,
    color: 'rgba(62,44,35,0.6)',
  },
  tableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  tableInfo: {
    flex: 1,
  },
  tableLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.espresso,
  },
  tableMeta: {
    fontSize: 13,
    color: 'rgba(62,44,35,0.5)',
    marginTop: 2,
  },
  tablePrice: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.forest,
    marginTop: 4,
  },
  bookButton: {
    backgroundColor: colors.rust,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 12,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
