import NetworkHeader from '@/components/NetworkHeader';
import { Colors } from '@/constants/theme';
import { SyncProvider } from '@/context/SyncContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ReduxProvider } from '@/store/Provider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const isLoaded = isSignedIn !== null;

  const segments = useSegments();
  const router = useRouter();

  const isAuthGroup = !!(segments && segments.length > 0 && segments[0] === '(auth)');

  const navTheme = useMemo(() => (colorScheme === 'dark' ? DarkTheme : DefaultTheme), [colorScheme]);
  const statusBarStyle = colorScheme === 'dark' ? 'light' : 'dark';
  const statusBarBackground =
    colorScheme === 'dark' ? Colors.dark?.background ?? Colors.dark : Colors.light?.background ?? Colors.light;

  // ✅ Redirect AFTER first render and after we read persisted auth
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const val = await AsyncStorage.getItem('SIGNED_IN');
        if (!mounted) return;
        setIsSignedIn(val === 'true');
      } catch (e) {
        if (!mounted) return;
        setIsSignedIn(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    // Only navigate after Root Layout mounted
    setTimeout(() => {
      if (isSignedIn && isAuthGroup) {
        router.replace('/(tabs)/customer'); // replace auth with tabs root
      }

      if (!isSignedIn && !isAuthGroup) {
        router.replace('/(auth)/sign-in'); // redirect to login
      }
    }, 0);
  }, [isLoaded, isSignedIn, isAuthGroup, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={statusBarStyle as any} backgroundColor={statusBarBackground as any} />
          <SyncProvider>
            <SafeAreaView edges={['top', 'bottom']}>
              {isSignedIn && !isAuthGroup && <NetworkHeader />}
            </SafeAreaView>

            {/* ✅ ALWAYS render Stack or Slot */}
            <Stack screenOptions={{ headerShown: false }}>
              <Slot />
            </Stack>
          </SyncProvider>
        </ThemeProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({});
