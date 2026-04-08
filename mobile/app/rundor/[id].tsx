import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api, type RouteWithStops } from '@/lib/api';
import { colors } from '@/constants/Colors';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [route, setRoute] = useState<RouteWithStops | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoute = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.routes.get(id);
      setRoute(data);
    } catch (err) {
      console.error('Failed to fetch route:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.rust} />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Rundan hittades inte</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.headerSection}>
        <Text style={styles.name}>{route.name}</Text>
        {route.creatorName ? (
          <Text style={styles.creator}>Skapad av {route.creatorName}</Text>
        ) : null}
        {route.planned_date ? (
          <View style={styles.infoRow}>
            <FontAwesome name="calendar" size={14} color="rgba(62,44,35,0.4)" />
            <Text style={styles.infoText}>{route.planned_date}</Text>
          </View>
        ) : null}
      </View>

      {route.description ? (
        <View style={styles.section}>
          <Text style={styles.description}>{route.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Stopp ({route.stops.length})
        </Text>
        {route.stops.map((stop, index) => (
          <View key={stop.id} style={styles.stopCard}>
            <View style={styles.stopNumber}>
              <Text style={styles.stopNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>
                {stop.fleaMarket?.name ?? 'Okänd loppis'}
              </Text>
              {stop.fleaMarket?.city ? (
                <Text style={styles.stopCity}>{stop.fleaMarket.city}</Text>
              ) : null}
            </View>
          </View>
        ))}

        {route.stops.length === 0 ? (
          <Text style={styles.emptyText}>Inga stopp i denna runda</Text>
        ) : null}
      </View>
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
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.espresso,
    marginBottom: 6,
  },
  creator: {
    fontSize: 15,
    color: 'rgba(62,44,35,0.5)',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    color: 'rgba(62,44,35,0.6)',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.espresso,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: colors.espresso,
    lineHeight: 22,
  },
  stopCard: {
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
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stopNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.espresso,
  },
  stopCity: {
    fontSize: 13,
    color: 'rgba(62,44,35,0.5)',
    marginTop: 2,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(62,44,35,0.5)',
  },
});
