import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type FleaMarket } from '@/lib/api';
import { colors } from '@/constants/Colors';

export default function ExploreScreen() {
  const router = useRouter();
  const [markets, setMarkets] = useState<FleaMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMarkets = useCallback(async () => {
    try {
      const result = await api.fleaMarkets.list();
      setMarkets(result.items);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMarkets();
  }, [fetchMarkets]);

  const renderItem = ({ item }: { item: FleaMarket }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/market/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <View
          style={[
            styles.badge,
            item.is_permanent ? styles.badgePermanent : styles.badgeTemporary,
          ]}
        >
          <Text style={styles.badgeText}>
            {item.is_permanent ? 'Permanent' : 'Tillfällig'}
          </Text>
        </View>
      </View>
      <Text style={styles.cardCity}>{item.city}</Text>
      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fyndstigen</Text>
        <Text style={styles.subtitle}>Hitta loppisar nära dig</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rust} />
        </View>
      ) : (
        <FlatList
          data={markets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.rust}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>Inga loppisar hittades</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.espresso,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(62,44,35,0.5)',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.espresso,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
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
  cardCity: {
    fontSize: 14,
    color: 'rgba(62,44,35,0.5)',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.espresso,
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(62,44,35,0.5)',
  },
});
