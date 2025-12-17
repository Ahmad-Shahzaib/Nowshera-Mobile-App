import { customerService } from '@/services/customerService';
import { logout } from '@/store/slices/auth';
import { useDispatch } from '@/store/store';
import { logoutThunk } from '@/store/thunk/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function LogoutScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    console.debug('[logout] current segments:', segments);
  }, [segments]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Attempt server logout but don't block final navigation on failure
        await dispatch(logoutThunk()).unwrap().catch(() => {});
      } finally {
        // Always perform local cleanup
        try { customerService.disableBackgroundSync(); } catch (e) { /* ignore */ }
        try { dispatch(logout()); } catch (e) { /* ignore */ }
        try { await AsyncStorage.removeItem('SIGNED_IN'); } catch (e) { /* ignore */ }

        // Debug: verify keys removed
        try {
          const signed = await AsyncStorage.getItem('SIGNED_IN');
          const token = await AsyncStorage.getItem('token');
          console.debug('[logout] post-cleanup SIGNED_IN=', signed, ' token=', token);
        } catch (e) {
          console.debug('[logout] failed to read async storage after cleanup', e);
        }

        // Ensure navigation runs after microtask queue to avoid router race conditions
        if (mounted) {
          setTimeout(() => {
            try {
              console.debug('[logout] Navigating to sign-in via router.replace');
              router.replace('/(auth)/sign-in');
            } catch (e) {
              /* ignore */
            }

            // Fallback: also try push shortly after in case replace is prevented
            setTimeout(() => {
              try {
                console.debug('[logout] Fallback router.push to sign-in');
                router.push('/(auth)/sign-in');
              } catch (e) {
                /* ignore */
              }
            }, 120);
          }, 50);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dispatch, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
