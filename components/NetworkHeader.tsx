import { Colors } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import useNetwork from '@/hooks/useNetwork';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NetworkHeader() {
  const { isConnected, refreshing, refresh } = useNetwork();
  const [syncing, setSyncing] = useState(false);
  const mountedRef = useRef(true);
  const syncCtx = (() => {
    try {
      return useSync();
    } catch (e) {
      // if SyncProvider isn't mounted, fallback
      return null as any;
    }
  })();

  // keep mountedRef for sync alerts
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onSync = async () => {
    if (syncing) return;
    setSyncing(true);

    try {
      const res = await (syncCtx?.syncNow ? syncCtx.syncNow() : Promise.resolve({ success: true, syncedCount: 0 }));
      if (mountedRef.current) {
        if (res.success) Alert.alert('Sync', `Data sync completed. ${res.syncedCount} item(s) synced.`);
        else Alert.alert('Sync', `Sync failed: ${res.error ?? 'unknown error'}`);
      }
    } catch (err) {
      if (mountedRef.current) Alert.alert('Sync', 'Sync failed. Try again.');
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  };

  const dotStyle = isConnected ? styles.dotOnline : styles.dotOffline;
  const unsynced = syncCtx?.unsyncedCount ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {isConnected === null ? (
          <ActivityIndicator size="small" color={Colors.light?.tint ?? '#0a84ff'} />
        ) : (
          <>
            <View style={[styles.dot, dotStyle]} />
            <Text style={[styles.statusText, isConnected ? styles.onlineText : styles.offlineText]}>
              {isConnected ? 'Online' : 'Offline'}
            </Text>
          </>
        )}
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onSync}
          style={[styles.button, (!isConnected || syncing) ? styles.buttonDisabled : null]}
          disabled={!isConnected || syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{unsynced > 0 ? `Sync (${unsynced})` : 'Sync'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light?.background ?? '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6e6e6',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  onlineText: {
    color: '#0a8a3f',
  },
  offlineText: {
    color: '#6c6c6c',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 6,
  },
  dotOnline: {
    backgroundColor: '#2ecc71',
  },
  dotOffline: {
    backgroundColor: '#c4c4c4',
  },
  right: {},
  button: {
    backgroundColor: Colors.light?.tint ?? '#0a84ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9aa4ad',
    opacity: 0.9,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
