import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * useNetwork
 * - returns current connectivity state (boolean | null)
 * - provides a refresh() to manually re-check
 * - listens to AppState changes and re-checks when app becomes active
 */
export default function useNetwork() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;
    // Avoid concurrent checks
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);

    try {
      const state = await Network.getNetworkStateAsync();
      if (!mountedRef.current) return;
      const reachable = typeof state.isInternetReachable === 'boolean' ? state.isInternetReachable : state.isConnected;
      setIsConnected(reachable ?? false);
      // setIsConnected(false);

    } catch (e) {
      if (!mountedRef.current) return;
      setIsConnected(false);
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // initial check
    check();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check();
    });

    return () => {
      mountedRef.current = false;
      try {
        sub.remove();
      } catch {}
    };
  }, [check]);

  const refresh = useCallback(async () => {
    await check();
  }, [check]);

  return { isConnected, refreshing, refresh } as const;
}
