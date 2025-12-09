import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

type Customer = {
  id: string;
  name: string;
  contact: string;
  email: string;
  openingBalance: string;
  balance: string;
};

const customers: Customer[] = [
  {
    id: '#CUST00001',
    name: 'Imran jenral store',
    contact: '+923007456340',
    email: 'Imran@gmail.com',
    openingBalance: '39,528.00 Rs.',
    balance: '162,006.00 Rs.',
  },
  {
    id: '#CUST00002',
    name: 'Abid 1 Super Store',
    contact: '+923066410520',
    email: 'abid@gmail.com',
    openingBalance: '0.00 Rs.',
    balance: '5,000.00 Rs.',
  },
  {
    id: '#CUST00003',
    name: 'Abid 2 Super Store',
    contact: '+923085886077',
    email: 'shahid@gmail.com',
    openingBalance: '0.00 Rs.',
    balance: '0.00 Rs.',
  },
  {
    id: '#CUST00004',
    name: 'Baba Riaz Kryana Store',
    contact: '+920000000000',
    email: 'baba@gmail.com',
    openingBalance: '0.00 Rs.',
    balance: '0.00 Rs.',
  },
  {
    id: '#CUST00005',
    name: 'Azhar Kryana Store',
    contact: '+923099403223',
    email: 'azhar@gmail.com',
    openingBalance: '4,736.00 Rs.',
    balance: '6,717.68 Rs.',
  },
  {
    id: '#CUST00006',
    name: 'Hasam Kryana Store',
    contact: '+923088660164',
    email: 'hasam@gmail.com',
    openingBalance: '0.00 Rs.',
    balance: '0.00 Rs.',
  },
];

export default function Customers() {
  const width = Dimensions.get('window').width;
  const router = useRouter();

  // pagination state
  const PAGE_SIZE = 4;
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const data = useMemo(() => {
    return customers.slice(0, page * PAGE_SIZE);
  }, [page]);

  const loadMore = useCallback(() => {
    if (data.length >= customers.length || loadingMore) return;
    setLoadingMore(true);
    // simulate async load
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 600);
  }, [data.length, loadingMore]);

  const renderItem = useCallback(({ item }: { item: typeof customers[number] }) => (
    <TouchableOpacity key={item.id} activeOpacity={0.9} style={styles.rowWrapper}>
      <ThemedView style={[styles.card, { width: width - 24 }] }>
        <View style={styles.left}>
          <TouchableOpacity style={styles.idChip} activeOpacity={0.85}>
            <ThemedText type="link" style={styles.idText}>{item.id}</ThemedText>
          </TouchableOpacity>

          <ThemedText type="defaultSemiBold" style={styles.name}>{item.name}</ThemedText>
          <ThemedText style={styles.meta}>{item.contact} · {item.email}</ThemedText>
        </View>

        <View style={styles.right}>
          <View style={styles.balanceBlock}>
            <ThemedText type="subtitle" style={styles.smallLabel}>Opening</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.balance}>{item.openingBalance}</ThemedText>
          </View>

          <View style={styles.balanceBlock}>
            <ThemedText type="subtitle" style={styles.smallLabel}>Balance</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.balance}>{item.balance}</ThemedText>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#f9b233' }]}>
              <ThemedText style={styles.actionIcon}>👁️</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: '#16a085' }]}
              onPress={() => router.push({ pathname: '/(tabs)/customer/[id]', params: { id: item.id } })}
            >
              <ThemedText style={styles.actionIcon}>✏️</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#ff4d6d' }]}>
              <ThemedText style={styles.actionIcon}>🗑️</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>
    </TouchableOpacity>
  ), [width]);

  const ListHeader = () => (
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
  );

  const ListFooter = () => (
    <View style={styles.footer}>
      {loadingMore ? <ActivityIndicator size="small" color={Colors.light.tint} /> : null}
    </View>
  );

  return (
    <View >
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // add extra bottom padding so last card isn't hidden behind bottom tab bar
  container: { paddingVertical: 12, paddingHorizontal: 12, paddingBottom: 100 },
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
  balanceBlock: { alignItems: 'flex-end' },
  smallLabel: { color: '#8f9598', fontSize: 11 },
  balance: { fontSize: 14 },
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
