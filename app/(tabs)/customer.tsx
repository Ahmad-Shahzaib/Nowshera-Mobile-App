import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import { customerService } from '@/services/customerService';
import { Customer } from '@/types/customer';

export default function Customers() {
  const width = Dimensions.get('window').width;
  const router = useRouter();
  const { unsyncedCount, isSyncing, syncNow, isOnline } = useSync();

  // State management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local unsynced customers count (from local DB)
  const [unsyncedLocalCount, setUnsyncedLocalCount] = useState<number>(0);

  // Pagination state
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch customers from service (offline-first)
  const fetchCustomers = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);

      const data = await customerService.getAllCustomers();
      console.log('Fetched customers:', data); // Debug: Check if balance is included
      setCustomers(data);
      try {
        const u = await customerService.getUnsyncedCount();
        setUnsyncedLocalCount(u);
      } catch (e) {
        setUnsyncedLocalCount(0);
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setError(err.message || 'Failed to load customers');
      Alert.alert('Error', err.message || 'Failed to load customers');
    }

    // Fetch all product items after successful login
    try {
      const { productService } = await import('@/services/productService');
      await productService.syncProducts();
      console.log('Products synced successfully after login');
    } catch (fetchError) {
      console.warn('Failed to sync products after login', fetchError);
    }

    finally {
      if (showLoader) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, []);

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchCustomers(false);

    // Also trigger sync if we have unsynced items
    if (unsyncedCount > 0 && isOnline) {
      await syncNow();
      // refresh local unsynced count after sync
      try {
        const u = await customerService.getUnsyncedCount();
        setUnsyncedLocalCount(u);
      } catch (e) {
        setUnsyncedLocalCount(0);
      }
    }
  }, [fetchCustomers, unsyncedCount, isOnline, syncNow]);

  // Manual sync
  const handleSync = useCallback(async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to the internet to sync data');
      return;
    }

    if (unsyncedCount === 0) {
      Alert.alert('All synced', 'All data is already synchronized');
      return;
    }

    const result = await syncNow();
    if (result.success) {
      Alert.alert('Success', `Synced ${result.syncedCount} customer(s)`);
      await fetchCustomers(false);
      try {
        const u = await customerService.getUnsyncedCount();
        setUnsyncedLocalCount(u);
      } catch (e) {
        setUnsyncedLocalCount(0);
      }
    } else {
      Alert.alert('Sync Failed', result.error || 'Failed to sync data');
    }
  }, [unsyncedCount, isOnline, syncNow, fetchCustomers]);

  // Delete customer
  const handleDeleteCustomer = useCallback(async (customerId: number, customerName: string) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete "${customerName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete using offline-first service
              await customerService.deleteCustomer(customerId);

              // Immediately update UI by removing the customer from state
              setCustomers(prevCustomers =>
                prevCustomers.filter(customer => customer.id !== customerId)
              );

              // Show success message
              Alert.alert('Success', 'Customer deleted successfully');
            } catch (err: any) {
              console.error('Delete error:', err);
              Alert.alert('Error', err.message || 'Failed to delete customer');
            }
          },
        },
      ]
    );
  }, []);

  // Paginated data
  const data = useMemo(() => {
    return customers.slice(0, page * PAGE_SIZE);
  }, [customers, page]);

  const loadMore = useCallback(() => {
    if (data.length >= customers.length || loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 300);
  }, [data.length, customers.length, loadingMore]);

  const renderItem = useCallback(({ item }: { item: Customer }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.rowWrapper}>
      <ThemedView style={[styles.card, { width: width - 24 }]}>
        <View style={styles.left}>
          <TouchableOpacity style={styles.idChip} activeOpacity={0.85}>
            <ThemedText type="link" style={styles.idText}>
              #{item.customer_id ? item.customer_id.toString().padStart(8, '0') : 'Pending'}
            </ThemedText>
          </TouchableOpacity>

          <ThemedText type="defaultSemiBold" style={styles.name}>{item.name}</ThemedText>
          <ThemedText style={styles.meta}>{item.contact} · {item.email}</ThemedText>
        </View>

        <View style={styles.right}>
          <View style={styles.balanceBlock}>
            <ThemedText type="subtitle" style={styles.smallLabel}>Balance</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.balance}>
              {item.balance || '0'} Rs.
            </ThemedText>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#f9b233' }]}
              onPress={() => item.id && router.push({ pathname: '/(tabs)/customer/[id]', params: { id: item.id.toString() } })}
              disabled={!item.id}
            >
              <ThemedText style={styles.actionIcon}>👁️</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#16a085' }]}
              onPress={() => item.id && router.push({ pathname: '/(tabs)/customer/edit/[id]', params: { id: item.id.toString() } })}
              disabled={!item.id}
            >
              <ThemedText style={styles.actionIcon}>✏️</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#ff4d6d' }]}
              onPress={() => item.id && handleDeleteCustomer(item.id, item.name)}
              disabled={!item.id}
            >
              <ThemedText style={styles.actionIcon}>🗑️</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    </TouchableOpacity>
  ), [width, router, handleDeleteCustomer]);

  const ListHeader = () => (
    <View>
      <View style={[styles.headerWrap, styles.headerRow]}>
        <ThemedText type="title" style={styles.header}>Customers</ThemedText>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addButton}
          onPress={() => router.push({ pathname: '/(tabs)/customer/create' })}
        >
          <ThemedText type="defaultSemiBold" style={styles.addButtonText}>+ Add Customer</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.statBadge}>
          <ThemedText style={styles.statText}>{customers.length}</ThemedText>
          <ThemedText style={[styles.statText, { fontSize: 12, marginLeft: 6 }]}>Customers</ThemedText>
        </View>

        {unsyncedLocalCount > 0 && (
          <View style={[styles.unsyncedBadge, { marginLeft: 12 }]}>
            <ThemedText style={styles.unsyncedText}>{unsyncedLocalCount} unsynced</ThemedText>
          </View>
        )}
        {unsyncedCount > 0 && isOnline && (
          <View style={[styles.syncInfo, { marginLeft: 12 }]}>
            <ThemedText style={styles.syncInfoText}>{unsyncedCount} pending sync</ThemedText>
          </View>
        )}
      </View>

      {/* Sync Status Bar */}
      <View >
        {/* <View style={styles.statusLeft}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
          <ThemedText style={styles.statusText}>
            {isOnline ? 'Online' : 'Offline'}
          </ThemedText>
          {unsyncedCount > 0 && (
            <View style={styles.unsyncedBadge}>
              <ThemedText style={styles.unsyncedText}>
                {unsyncedCount} pending
              </ThemedText>
            </View>
          )}
          {isSyncing && (
            <ActivityIndicator size="small" color={Colors.light.tint} style={{ marginLeft: 8 }} />
          )}
        </View> */}

        {unsyncedCount > 0 && isOnline && !isSyncing && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSync}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.syncButtonText}>🔄 Sync Now</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const ListFooter = () => (
    <View style={styles.footer}>
      {loadingMore ? <ActivityIndicator size="small" color={Colors.light.tint} /> : null}
    </View>
  );

  return (
    <View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Loading customers...</ThemedText>
        </View>
      ) : error && customers.length === 0 ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchCustomers()}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => item.id ? item.id.toString() : `customer-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.tint]}
              tintColor={Colors.light.tint}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // add extra bottom padding so last card isn't hidden behind bottom tab bar
  container: { paddingVertical: 12, paddingHorizontal: 12, paddingBottom: 100 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b6f73',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#ff4d6d',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: Platform.select({ ios: 'rgba(255,255,255,0.98)', default: '#fff' }),
    // subtle shadow
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
    borderWidth: 1,
    borderColor: '#f0f4f6',
    // width is handled per-item so don't force alignSelf here
  },
  rowWrapper: { width: '100%', alignItems: 'center', marginBottom: 6 },
  headerWrap: { paddingBottom: 6 },
  header: { fontSize: 20, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontSize: 13 },
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  unsyncedBadge: {
    backgroundColor: '#fef3c7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  unsyncedText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  statText: {
    color: '#1e3a8a',
    fontWeight: '700',
    fontSize: 14,
  },
  syncInfo: {
    backgroundColor: '#e6fffa',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  syncInfoText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  left: { flex: 1, paddingRight: 10 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  idChip: {
    borderWidth: 1.2,
    borderColor: Colors.light.tint,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  idText: {
    color: Colors.light.tint,
    fontWeight: '700',
    fontSize: 12,
  },
  name: {
    fontSize: 16,
    marginBottom: 4,
  },
  meta: {
    color: '#6b6f73',
    fontSize: 13,
  },
  balanceBlock: { alignItems: 'flex-end', marginBottom: 8 },
  smallLabel: { color: '#8f9598', fontSize: 11 },
  balance: { fontSize: 14, fontWeight: '600', color: '#10b981' },
  actions: { flexDirection: 'row', marginTop: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionIcon: { fontSize: 14, color: '#fff' },
  // keep a spacer footer so content can scroll above tab bar
  footer: { paddingVertical: 6, alignItems: 'center', height: 5 },
});
