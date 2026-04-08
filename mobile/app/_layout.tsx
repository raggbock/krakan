import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth-context';
import { colors } from '@/constants/Colors';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.parchment },
          headerTintColor: colors.espresso,
          contentStyle: { backgroundColor: colors.parchment },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{
            presentation: 'modal',
            title: 'Logga in',
          }}
        />
        <Stack.Screen
          name="market/[id]"
          options={{
            title: '',
          }}
        />
        <Stack.Screen
          name="rundor/[id]"
          options={{
            title: 'Runda',
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
