import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InvoiceItem = {
  id: string;
  invoiceNo: string;
  customer: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
};

const SAMPLE_INVOICES: InvoiceItem[] = [
  {
    id: '1',
    invoiceNo: '#INVO00003',
    customer: 'Yasir Foam Center',
    issueDate: 'Sep 21, 2025',
    dueDate: 'Sep 21, 2025',
    amount: '45,297.44 Rs.',
    status: 'Partially Paid',
  },
  {
    id: '2',
    invoiceNo: '#INVO00004',
    customer: 'Master Display Timber [Zubair]',
    issueDate: 'Sep 21, 2025',
    dueDate: 'Sep 21, 2025',
    amount: '241,596.00 Rs.',
    status: 'Partially Paid',
  },
  {
    id: '3',
    invoiceNo: '#INVO00005',
    customer: 'Acme Supplies',
    issueDate: 'Oct 01, 2025',
    dueDate: 'Oct 10, 2025',
    amount: '12,000.00 Rs.',
    status: 'Unpaid',
  },
  {
    id: '4',
    invoiceNo: '#INVO00006',
    customer: 'Al-Noor Electronics',
    issueDate: 'Oct 03, 2025',
    dueDate: 'Oct 15, 2025',
    amount: '78,950.00 Rs.',
    status: 'Paid',
  },
  {
    id: '5',
    invoiceNo: '#INVO00007',
    customer: 'Bright Furniture Works',
    issueDate: 'Oct 05, 2025',
    dueDate: 'Oct 20, 2025',
    amount: '156,750.00 Rs.',
    status: 'Unpaid',
  },
  {
    id: '6',
    invoiceNo: '#INVO00008',
    customer: 'TechZone Computers',
    issueDate: 'Oct 08, 2025',
    dueDate: 'Oct 25, 2025',
    amount: '92,340.00 Rs.',
    status: 'Paid',
  },
  {
    id: '7',
    invoiceNo: '#INVO00009',
    customer: 'Smart Home Solutions',
    issueDate: 'Oct 10, 2025',
    dueDate: 'Oct 30, 2025',
    amount: '33,120.00 Rs.',
    status: 'Partially Paid',
  },
  {
    id: '8',
    invoiceNo: '#INVO00010',
    customer: 'City Light Traders',
    issueDate: 'Oct 12, 2025',
    dueDate: 'Oct 28, 2025',
    amount: '59,875.00 Rs.',
    status: 'Paid',
  },
  {
    id: '9',
    invoiceNo: '#INVO00011',
    customer: 'Metro Construction Co.',
    issueDate: 'Oct 14, 2025',
    dueDate: 'Oct 31, 2025',
    amount: '420,000.00 Rs.',
    status: 'Unpaid',
  },
  {
    id: '10',
    invoiceNo: '#INVO00012',
    customer: 'Premier Paints & Coatings',
    issueDate: 'Oct 18, 2025',
    dueDate: 'Nov 01, 2025',
    amount: '85,600.00 Rs.',
    status: 'Paid',
  },
];


// We'll define row and badge components inside the main component so they can use
// responsive sizes and theme-aware colors from hooks.

export default function Invoice() {
  const resp = useResponsive();
  const router = useRouter();
  // useThemeColor will pick the right color from Colors.light/dark
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  // Filter state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<InvoiceItem['status'] | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<TextInput | null>(null);

  // build unique lists from sample data for dropdowns
  const customerOptions = useMemo(() => Array.from(new Set(SAMPLE_INVOICES.map((i) => i.customer))), []);
  const statusOptions: InvoiceItem['status'][] = ['Paid', 'Partially Paid', 'Unpaid'];
  const shopOptions = useMemo(() => ['Main Shop', 'Outlet A', 'Outlet B'], []);

  // helper to format the date similarly to sample data
  const formatDateLabel = (d: Date | null) => {
    if (!d) return 'Pick date';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  function StatusBadge({ status }: { status: InvoiceItem['status'] }) {
    const bgColor = status === 'Paid' ? '#2ecc71' : status === 'Partially Paid' ? '#3bb1b8' : '#f39c12';
    return (
      <View style={[stylesLocal.statusBadge, { backgroundColor: bgColor }]} accessibilityRole="text">
        <Text style={stylesLocal.statusText}>{status}</Text>
      </View>
    );
  }

  function InvoiceRow({ item }: { item: InvoiceItem }) {
    const width = resp.width;
    const router = useRouter();

    return (
  <TouchableOpacity activeOpacity={0.9} style={stylesLocal.rowWrapper} onPress={() => router.push({ pathname: '/(tabs)/invoice/[id]', params: { id: item.id } })} accessibilityRole="button">
        <ThemedView style={[stylesLocal.card, { width: '100%' }]}>
          <View style={stylesLocal.left}>
            <TouchableOpacity style={stylesLocal.idChip} activeOpacity={0.85}>
              <ThemedText type="link" style={stylesLocal.idText}>{item.invoiceNo}</ThemedText>
            </TouchableOpacity>

            <ThemedText type="defaultSemiBold" style={[stylesLocal.name, { color: text }]}>{item.customer}</ThemedText>
            <ThemedText style={stylesLocal.meta}>{item.issueDate} · {item.dueDate}</ThemedText>
          </View>

          <View style={stylesLocal.right}>
            <View style={stylesLocal.balanceBlock}>
              <ThemedText type="subtitle" style={stylesLocal.smallLabel}>Due Amount</ThemedText>
              <ThemedText type="defaultSemiBold" style={stylesLocal.balance}>{item.amount}</ThemedText>
            </View>

            <View style={stylesLocal.balanceBlock}>
              <StatusBadge status={item.status} />
            </View>

            <View style={stylesLocal.actions}>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#f9b233' }]}
                accessibilityLabel={`View ${item.invoiceNo}`}
                onPress={() => router.push({ pathname: '/(tabs)/invoice/[id]', params: { id: item.id } })}
              >
                <MaterialIcons name="visibility" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#16a085' }]}
                onPress={() => router.push({ pathname: '/(tabs)/invoice/edit/[id]', params: { id: item.id } })}
                accessibilityLabel={`Edit ${item.invoiceNo}`}
              >
                <MaterialIcons name="edit" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[stylesLocal.iconBtn, { backgroundColor: '#ff4d6d' }]} accessibilityLabel={`Delete ${item.invoiceNo}`}>
                <MaterialIcons name="delete" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </ThemedView>
      </TouchableOpacity>
    );
  }

  // Simple modal dropdown used for customer/status/shop selection
  function DropdownModal({ visible, title, options, onClose, onSelect }: { visible: boolean; title: string; options: string[]; onClose: () => void; onSelect: (value: string) => void; }) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={stylesLocal.modalOverlay} onPress={onClose} />
        <View style={stylesLocal.modalContent}>
          <Text style={stylesLocal.modalTitle}>{title}</Text>
          <ScrollView>
            {options.map((opt) => (
              <TouchableOpacity key={opt} style={stylesLocal.modalItem} onPress={() => { onSelect(opt); onClose(); }}>
                <Text style={stylesLocal.modalItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Very small calendar modal to pick a single date (basic implementation)
  function CalendarModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (d: Date) => void; }) {
    const today = new Date();
    const [monthOffset, setMonthOffset] = useState(0);
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();

    // compute days in month and weekday of first day
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const weeks: Array<Array<number | null>> = [];
    let current = 1 - firstWeekday; // start index
    while (current <= daysInMonth) {
      const week: Array<number | null> = [];
      for (let i = 0; i < 7; i++) {
        if (current > 0 && current <= daysInMonth) week.push(current);
        else week.push(null);
        current += 1;
      }
      weeks.push(week);
    }

    const label = base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return (
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={stylesLocal.modalOverlay} onPress={onClose} />
        <View style={stylesLocal.calendarContainer}>
          <View style={stylesLocal.calendarHeader}>
            <TouchableOpacity onPress={() => setMonthOffset((m) => m - 1)}><Text style={stylesLocal.calendarNav}>◀</Text></TouchableOpacity>
            <Text style={stylesLocal.calendarLabel}>{label}</Text>
            <TouchableOpacity onPress={() => setMonthOffset((m) => m + 1)}><Text style={stylesLocal.calendarNav}>▶</Text></TouchableOpacity>
          </View>
          <View style={stylesLocal.weekdaysRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <Text key={d} style={stylesLocal.weekday}>{d}</Text>)}
          </View>
          <View>
            {weeks.map((week, idx) => (
              <View key={idx} style={stylesLocal.weekRow}>
                {week.map((day, i) => (
                  <TouchableOpacity
                    key={i}
                    style={day ? stylesLocal.dayBtn : stylesLocal.dayBtnEmpty}
                    disabled={!day}
                    onPress={() => {
                      if (!day) return;
                      onSelect(new Date(year, month, day));
                      onClose();
                    }}
                  >
                    <Text style={stylesLocal.dayText}>{day ?? ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    );
  }

  // filtered list of invoices (memoized)
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return SAMPLE_INVOICES.filter((inv) => {
      if (selectedCustomer && inv.customer !== selectedCustomer) return false;
      if (selectedStatus && inv.status !== selectedStatus) return false;
      if (selectedShop && !inv.customer.toLowerCase().includes(selectedShop.toLowerCase())) return false;
      if (selectedDate) {
        const dLabel = formatDateLabel(selectedDate);
        if (inv.issueDate !== dLabel && inv.dueDate !== dLabel) return false;
      }

      if (q) {
        // match invoice number, customer name or amount (case-insensitive)
        const invoiceNo = inv.invoiceNo.toLowerCase();
        const customer = inv.customer.toLowerCase();
        const amount = inv.amount.toLowerCase();
        if (!invoiceNo.includes(q) && !customer.includes(q) && !amount.includes(q)) return false;
      }

      return true;
    });
  }, [selectedCustomer, selectedStatus, selectedShop, selectedDate, searchText]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
        <View style={[stylesLocal.headerWrap, stylesLocal.headerRow]}>
          <ThemedText type="defaultSemiBold" style={[stylesLocal.title, { color: text }]}>Manage Invoices</ThemedText>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[stylesLocal.addButton, { backgroundColor: tint }]}
            accessibilityLabel="Create invoice"
            onPress={() => router.push('/(tabs)/invoice/create')}
          >
            <ThemedText type="defaultSemiBold" style={stylesLocal.addButtonText}>+ Create Invoice</ThemedText>
          </TouchableOpacity>
        </View>

 <View style={stylesLocal.filtersFooter}>
              <View style={{ flex: 1 }} />
              <View style={stylesLocal.iconGroupCompact}>
                <TouchableOpacity style={stylesLocal.iconCircle} accessibilityLabel="Search" onPress={() => { searchInputRef.current?.focus(); }}>
                  <MaterialIcons name="search" size={resp.fontSize(16)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={[stylesLocal.iconCircle]} accessibilityLabel="Reset" onPress={() => {
                  // clear all filters, close modals and clear search
                  setSelectedDate(null);
                  setSelectedCustomer(null);
                  setSelectedStatus(null);
                  setSelectedShop(null);
                  setShowDateModal(false);
                  setShowCustomerModal(false);
                  setShowStatusModal(false);
                  setShowShopModal(false);
                  setSearchText('');
                }}>
                  <MaterialIcons name="refresh" size={resp.fontSize(16)} color="#00" />
                </TouchableOpacity>
              </View>
            </View>
        <View style={stylesLocal.filtersCompact}>
          <View style={stylesLocal.filtersGrid}>
            <TouchableOpacity style={stylesLocal.filterItem} accessibilityLabel="Pick issue date" onPress={() => setShowDateModal(true)}>
              <Text style={[stylesLocal.filterText, { color: icon }]}>📅 {formatDateLabel(selectedDate)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} accessibilityLabel="Select customer" onPress={() => setShowCustomerModal(true)}>
              <Text style={[stylesLocal.filterText, { color: icon }]}>{selectedCustomer ?? 'Customer ▾'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} accessibilityLabel="Select status" onPress={() => setShowStatusModal(true)}>
              <Text style={[stylesLocal.filterText, { color: icon }]}>{selectedStatus ?? 'Status ▾'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} accessibilityLabel="Select shop" onPress={() => setShowShopModal(true)}>
              <Text style={[stylesLocal.filterText, { color: icon }]}>{selectedShop ?? 'Shop ▾'}</Text>
            </TouchableOpacity>
          </View>

           
        </View>

        {/* Dropdown / calendar modals */}
        <DropdownModal visible={showCustomerModal} title="Select customer" options={customerOptions} onClose={() => setShowCustomerModal(false)} onSelect={(v) => setSelectedCustomer(v)} />
        <DropdownModal visible={showStatusModal} title="Select status" options={statusOptions} onClose={() => setShowStatusModal(false)} onSelect={(v) => setSelectedStatus(v as InvoiceItem['status'])} />
        <DropdownModal visible={showShopModal} title="Select shop" options={shopOptions} onClose={() => setShowShopModal(false)} onSelect={(v) => setSelectedShop(v)} />
        <CalendarModal visible={showDateModal} onClose={() => setShowDateModal(false)} onSelect={(d) => setSelectedDate(d)} />

        <View style={stylesLocal.controls}>
          <TextInput
            ref={searchInputRef}
            placeholder="Search..."
            placeholderTextColor={icon}
            style={stylesLocal.search}
            accessibilityLabel="Search invoices"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <InvoiceRow item={item} />}
          contentContainerStyle={{ paddingBottom: resp.vertical(30) }}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: { flex: 1, paddingVertical: resp.horizontalScale(16),
      paddingHorizontal: resp.horizontalScale(16),
      marginBottom: resp.vertical(20),
      
      backgroundColor: theme.bg },
    header: { marginBottom: resp.vertical(12) },
    title: { fontSize: resp.fontSize(18) },
    filters: {
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#1a1a1a',
      borderRadius: resp.horizontalScale(10),
      padding: resp.horizontalScale(12),
      marginBottom: resp.vertical(12),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    input: {
      flex: 1,
      minWidth: resp.horizontalScale(140),
      height: resp.vertical(42),
      borderRadius: resp.horizontalScale(6),
      borderWidth: 1,
      borderColor: '#e6eaee',
      paddingHorizontal: resp.horizontalScale(12),
      marginRight: resp.horizontalScale(8),
    },
    select: {
      minWidth: resp.horizontalScale(140),
      height: resp.vertical(42),
      borderRadius: resp.horizontalScale(6),
      borderWidth: 1,
      borderColor: '#e6eaee',
      paddingHorizontal: resp.horizontalScale(12),
      justifyContent: 'center',
      marginRight: resp.horizontalScale(8),
    },
    selectText: { color: theme.icon },
    filterIconBtn: { width: resp.horizontalScale(40), height: resp.horizontalScale(40), borderRadius: resp.horizontalScale(6), backgroundColor: '#00a3e0' },
    iconGroup: { flexDirection: 'row' },
    controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: resp.vertical(12) },
    entriesBox: { flexDirection: 'row', alignItems: 'center' },
    entriesText: { color: theme.text, fontSize: resp.fontSize(14) },
    search: { flex: 1, height: resp.vertical(40), borderRadius: resp.horizontalScale(6), borderWidth: 1, borderColor: '#e6eaee', paddingHorizontal: resp.horizontalScale(12) },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      padding: resp.horizontalScale(12),
      borderRadius: resp.horizontalScale(8),
      marginBottom: resp.vertical(10),
    },
    invButton: { borderWidth: 1, borderColor: theme.tint, paddingHorizontal: resp.horizontalScale(10), paddingVertical: resp.vertical(6), borderRadius: resp.horizontalScale(8) },
    invButtonText: { color: theme.tint, fontWeight: '600', fontSize: resp.fontSize(13) },
    rowMain: { flex: 1, marginLeft: resp.horizontalScale(12) },
    customer: { fontSize: resp.fontSize(15), marginBottom: resp.vertical(6) },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaLabel: { color: '#8b9498', fontSize: resp.fontSize(13) },
    amount: { color: '#ff2d6f', fontWeight: '600', fontSize: resp.fontSize(13) },
    rowRight: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: resp.horizontalScale(10), paddingVertical: resp.vertical(6), borderRadius: resp.horizontalScale(16), marginBottom: resp.vertical(8) },
    statusText: { color: '#fff', fontWeight: '600', fontSize: resp.fontSize(12) },
    actions: { flexDirection: 'row' },
    actionDot: { width: resp.horizontalScale(28), height: resp.horizontalScale(28), borderRadius: resp.horizontalScale(6) },
    // card-like styles (mirrors the style used in app/(tabs)/customer.tsx)
    rowWrapper: { width: '100%', alignItems: 'stretch', marginBottom: resp.vertical(6) },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: resp.vertical(14),
      paddingHorizontal: resp.horizontalScale(14),
      marginBottom: resp.vertical(10),
      borderRadius: resp.horizontalScale(12),
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12 },
        android: { elevation: 2 },
      }),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#f0f4f6' : '#1a1a1a',
    },
    left: { flex: 1, paddingRight: resp.horizontalScale(10) },
    right: { alignItems: 'flex-end', justifyContent: 'center' },
    idChip: {
      borderWidth: 1.2,
      borderColor: theme.tint,
      paddingVertical: resp.vertical(6),
      paddingHorizontal: resp.horizontalScale(8),
      borderRadius: resp.horizontalScale(8),
      alignSelf: 'flex-start',
      marginBottom: resp.vertical(6),
    },
    idText: { color: theme.tint, fontWeight: '700', fontSize: resp.fontSize(12) },
    name: { fontSize: resp.fontSize(16), marginBottom: resp.vertical(4) },
    meta: { color: '#6b6f73', fontSize: resp.fontSize(13) },
    balanceBlock: { alignItems: 'flex-end' },
    smallLabel: { color: '#8f9598', fontSize: resp.fontSize(11) },
    balance: { fontSize: resp.fontSize(14) },
    iconBtn: {
      width: resp.horizontalScale(36),
      height: resp.horizontalScale(36),
      borderRadius: resp.horizontalScale(10),
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: resp.horizontalScale(8),
    },
    actionIcon: { fontSize: resp.fontSize(14), color: '#fff' },
    // compact filter row styles
    filtersCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#141414',
      borderRadius: resp.horizontalScale(10),
      paddingVertical: resp.vertical(8),
      paddingHorizontal: resp.horizontalScale(8),
      marginBottom: resp.vertical(12),
      gap: 0,
    },
    filterItem: {
      minWidth: resp.horizontalScale(88),
      width: '48%',
      paddingVertical: resp.vertical(8),
      paddingHorizontal: resp.horizontalScale(12),
      borderRadius: resp.horizontalScale(8),
      backgroundColor: theme.bg === Colors.light.background ? '#fbfdff' : '#0f0f0f',
      borderWidth: 1,
      borderColor: '#e6eaee',
      marginBottom: resp.vertical(8),
    },
    filterText: { fontSize: resp.fontSize(13) },
    iconGroupCompact: { flexDirection: 'row', marginLeft: resp.horizontalScale(8) },
    iconCircle: { width: resp.horizontalScale(20), height: resp.horizontalScale(20), borderRadius: resp.horizontalScale(10),  marginLeft: resp.horizontalScale(8) },
    // modal styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
    modalContent: { position: 'absolute', left: '6%', right: '6%', top: '25%', maxHeight: '50%', backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f', borderRadius: resp.horizontalScale(10), padding: resp.horizontalScale(12), borderWidth: 1, borderColor: '#e6eaee' },
    modalTitle: { fontSize: resp.fontSize(16), marginBottom: resp.vertical(6), color: theme.text, fontWeight: '700' },
    modalItem: { paddingVertical: resp.vertical(10), borderBottomWidth: 1, borderBottomColor: '#e6eaee' },
    modalItemText: { color: theme.text },
    // calendar styles
    calendarContainer: { position: 'absolute', left: '6%', right: '6%', top: '20%', backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f', borderRadius: resp.horizontalScale(10), padding: resp.horizontalScale(12), borderWidth: 1, borderColor: '#e6eaee' },
    calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: resp.vertical(6) },
    calendarNav: { fontSize: resp.fontSize(18), color: theme.text },
    calendarLabel: { fontSize: resp.fontSize(15), color: theme.text, fontWeight: '600' },
    weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: resp.vertical(6) },
    weekday: { width: resp.horizontalScale(36), textAlign: 'center', color: '#8f9598' },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: resp.vertical(4) },
    dayBtn: { width: resp.horizontalScale(36), height: resp.horizontalScale(36), borderRadius: resp.horizontalScale(8), alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f6f8' },
    dayBtnEmpty: { width: resp.horizontalScale(36), height: resp.horizontalScale(36), alignItems: 'center', justifyContent: 'center' },
    dayText: { color: theme.text },
    filtersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  filtersFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: resp.vertical(6) },
    headerWrap: { paddingBottom: resp.vertical(6) },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addButton: { paddingVertical: resp.vertical(6), paddingHorizontal: resp.horizontalScale(10), borderRadius: resp.horizontalScale(8) },
    addButtonText: { color: '#fff', fontSize: resp.fontSize(13) },
  });
