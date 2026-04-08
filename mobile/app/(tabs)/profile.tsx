import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/lib/auth-context';
import { api, type FleaMarket, type RouteSummary } from '@/lib/api';
import { colors } from '@/constants/Colors';

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [myMarkets, setMyMarkets] = useState<FleaMarket[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [markets, routes] = await Promise.all([
        api.fleaMarkets.listByOrganizer(user.id),
        api.routes.listByUser(user.id),
      ]);
      setMyMarkets(markets);
      setMyRoutes(routes);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Fel', 'Kunde inte logga ut. Försök igen.');
    }
  }, [signOut]);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rust} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.centered}>
          <FontAwesome name="user-circle" size={64} color="rgba(62,44,35,0.2)" />
          <Text style={styles.loginPrompt}>Logga in för att se din profil</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.primaryButtonText}>Logga in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
        </View>

        <View style={styles.profileCard}>
          <FontAwesome name="user-circle" size={48} color={colors.rust} />
          <View style={styles.profileInfo}>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        {/* Mina loppisar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mina loppisar</Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.sectionAction}>Skapa ny</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.rust} style={{ marginTop: 12 }} />
          ) : myMarkets.length === 0 ? (
            <Text style={styles.emptyText}>Du har inga loppisar ännu</Text>
          ) : (
            myMarkets.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.listItem}
                onPress={() => router.push(`/market/${m.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{m.name}</Text>
                  <Text style={styles.listItemSub}>{m.city}</Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color="rgba(62,44,35,0.3)" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Mina rundor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mina rundor</Text>
          {loading ? (
            <ActivityIndicator color={colors.rust} style={{ marginTop: 12 }} />
          ) : myRoutes.length === 0 ? (
            <Text style={styles.emptyText}>Du har inga rundor ännu</Text>
          ) : (
            myRoutes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.listItem}
                onPress={() => router.push(`/rundor/${r.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{r.name}</Text>
                  <Text style={styles.listItemSub}>
                    {r.stopCount} stopp
                    {r.planned_date ? ` \u00b7 ${r.planned_date}` : ''}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={14} color="rgba(62,44,35,0.3)" />
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <FontAwesome name="sign-out" size={18} color={colors.error} />
          <Text style={styles.signOutText}>Logga ut</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 80,
  },
  loginPrompt: {
    fontSize: 16,
    color: 'rgba(62,44,35,0.5)',
  },
  primaryButton: {
    backgroundColor: colors.rust,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  email: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.espresso,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.espresso,
    marginBottom: 8,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rust,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(62,44,35,0.5)',
    marginTop: 4,
  },
  listItem: {
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
  listItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.espresso,
  },
  listItemSub: {
    fontSize: 13,
    color: 'rgba(62,44,35,0.5)',
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.error,
  },
});
