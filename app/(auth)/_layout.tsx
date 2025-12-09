import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

export default function AuthRoutesLayout() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const val = await AsyncStorage.getItem('SIGNED_IN');
        if (!mounted) return;
        if (val === 'true') {
          // already signed in -> go to tabs root
          router.replace('/(tabs)/customer');
        }
      } catch (e) {
        // ignore and let auth routes render
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

