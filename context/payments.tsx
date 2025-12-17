import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PaymentItem = {
  id: string;
  paymentNo: string;
  customer: string;
  paymentDate: string;
  amount: string;
  method: 'Cash' | 'Bank Transfer' | 'Check' | 'Card';
  status: 'Completed' | 'Pending' | 'Failed';
  reference?: string;
};

const SAMPLE_PAYMENTS: PaymentItem[] = [
  {
    id: '1',
    paymentNo: '#SCPV00010',
    customer: 'Yasir Foam Center',
    paymentDate: 'Sep 21, 2025',
    amount: '70,000.00 Rs.',
    method: 'Bank Transfer',
    status: 'Completed',
    reference: 'Customer Payment (A/R)',
  },
  {
    id: '2',
    paymentNo: '#SCPV00011',
    customer: 'Master Display Timber [Zubair]',
    paymentDate: 'Sep 21, 2025',
    amount: '150,000.00 Rs.',
    method: 'Cash',
    status: 'Completed',
    reference: 'Partial Payment',
  },
  {
    id: '3',
    paymentNo: '#SCPV00012',
    customer: 'Acme Supplies',
    paymentDate: 'Oct 01, 2025',
    amount: '12,000.00 Rs.',
    method: 'Check',
    status: 'Pending',
    reference: 'Invoice Settlement',
  },
  {
    id: '4',
    paymentNo: '#SCPV00013',
    customer: 'Al-Noor Electronics',
    paymentDate: 'Oct 03, 2025',
    amount: '78,950.00 Rs.',
    method: 'Card',
    status: 'Completed',
    reference: 'Full Payment',
  },
  {
    id: '5',
    paymentNo: '#SCPV00014',
    customer: 'Bright Furniture Works',
    paymentDate: 'Oct 05, 2025',
    amount: '75,000.00 Rs.',
    method: 'Bank Transfer',
    status: 'Failed',
    reference: 'Payment Attempt',
  },
  {
    id: '6',
    paymentNo: '#SCPV00015',
    customer: 'TechZone Computers',
    paymentDate: 'Oct 08, 2025',
    amount: '92,340.00 Rs.',
    method: 'Cash',
    status: 'Completed',
    reference: 'Direct Payment',
  },
  {
    id: '7',
    paymentNo: '#SCPV00016',
    customer: 'Smart Home Solutions',
    paymentDate: 'Oct 10, 2025',
    amount: '33,120.00 Rs.',
    method: 'Bank Transfer',
    status: 'Completed',
    reference: 'Partial Settlement',
  },
  {
    id: '8',
    paymentNo: '#SCPV00017',
    customer: 'City Light Traders',
    paymentDate: 'Oct 12, 2025',
    amount: '59,875.00 Rs.',
    method: 'Check',
    status: 'Pending',
    reference: 'Outstanding Payment',
  },
  {
    id: '9',
    paymentNo: '#SCPV00018',
    customer: 'Metro Construction Co.',
    paymentDate: 'Oct 14, 2025',
    amount: '200,000.00 Rs.',
    method: 'Bank Transfer',
    status: 'Completed',
    reference: 'Advance Payment',
  },
  {
    id: '10',
    paymentNo: '#SCPV00019',
    customer: 'Premier Paints & Coatings',
    paymentDate: 'Oct 18, 2025',
    amount: '85,600.00 Rs.',
    method: 'Card',
    status: 'Completed',
    reference: 'Final Payment',
  },
];

export default function Payments() {
  const resp = useResponsive();
  const router = useRouter();
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
  const [selectedStatus, setSelectedStatus] = useState<PaymentItem['status'] | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentItem['method'] | null>(null);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<TextInput | null>(null);

  // Build unique lists from sample data for dropdowns
  const customerOptions = useMemo(() => Array.from(new Set(SAMPLE_PAYMENTS.map((p) => p.customer))), []);
  const statusOptions: PaymentItem['status'][] = ['Completed', 'Pending', 'Failed'];
  const methodOptions: PaymentItem['method'][] = ['Cash', 'Bank Transfer', 'Check', 'Card'];

  // Helper to format the date similarly to sample data
  const formatDateLabel = (d: Date | null) => {
    if (!d) return 'Pick date';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  function StatusBadge({ status }: { status: PaymentItem['status'] }) {
    const bgColor = status === 'Completed' ? '#2ecc71' : status === 'Pending' ? '#f39c12' : '#e74c3c';
    return (
      <View style={[stylesLocal.statusBadge, { backgroundColor: bgColor }]} accessibilityRole="text">
        <Text style={stylesLocal.statusText}>{status}</Text>
      </View>
    );
  }

  function MethodBadge({ method }: { method: PaymentItem['method'] }) {
    const bgColor = method === 'Cash' ? '#27ae60' : method === 'Bank Transfer' ? '#3498db' : method === 'Check' ? '#9b59b6' : '#e67e22';
    return (
      <View style={[stylesLocal.methodBadge, { backgroundColor: bgColor }]} accessibilityRole="text">
        <Text style={stylesLocal.methodText}>{method}</Text>
      </View>
    );
  }

  function PaymentRow({ item }: { item: PaymentItem }) {
    return (
      <TouchableOpacity 
        activeOpacity={0.9} 
        style={stylesLocal.rowWrapper} 
        onPress={() => console.log('Navigate to payment detail:', item.id)} 
        accessibilityRole="button"
      >
        <ThemedView style={[stylesLocal.card, { width: '100%' }]}>
          <View style={stylesLocal.left}>
            <TouchableOpacity style={stylesLocal.idChip} activeOpacity={0.85}>
              <Text style={stylesLocal.idText}>{item.paymentNo}</Text>
            </TouchableOpacity>

            <ThemedText type="defaultSemiBold" style={[stylesLocal.name, { color: text }]}>
              {item.customer}
            </ThemedText>
            <ThemedText style={stylesLocal.meta}>
              {item.paymentDate} · {item.reference}
            </ThemedText>
          </View>

          <View style={stylesLocal.right}>
            <View style={stylesLocal.balanceBlock}>
              <Text style={stylesLocal.smallLabel}>Amount</Text>
              <Text style={stylesLocal.balance}>{item.amount}</Text>
            </View>

            <View style={stylesLocal.balanceBlock}>
              <StatusBadge status={item.status} />
            </View>

            <View style={stylesLocal.balanceBlock}>
              <MethodBadge method={item.method} />
            </View>

            <View style={stylesLocal.actions}>
              <TouchableOpacity style={[stylesLocal.iconBtn, { backgroundColor: '#00bcd4' }]} accessibilityLabel="View payment">
                <MaterialIcons name="visibility" style={stylesLocal.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity style={[stylesLocal.iconBtn, { backgroundColor: '#4caf50' }]} accessibilityLabel="Edit payment">
                <MaterialIcons name="edit" style={stylesLocal.actionIcon} />
              </TouchableOpacity>
              <TouchableOpacity style={[stylesLocal.iconBtn, { backgroundColor: '#f44336' }]} accessibilityLabel="Delete payment">
                <MaterialIcons name="delete" style={stylesLocal.actionIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </ThemedView>
      </TouchableOpacity>
    );
  }

  // Simple modal dropdown used for customer/status/method selection
  function DropdownModal({ 
    visible, 
    title, 
    options, 
    onClose, 
    onSelect 
  }: { 
    visible: boolean; 
    title: string; 
    options: string[]; 
    onClose: () => void; 
    onSelect: (value: string) => void; 
  }) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={stylesLocal.modalOverlay} onPress={onClose} />
        <View style={stylesLocal.modalContent}>
          <Text style={stylesLocal.modalTitle}>{title}</Text>
          <ScrollView>
            {options.map((opt) => (
              <TouchableOpacity 
                key={opt} 
                style={stylesLocal.modalItem} 
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={stylesLocal.modalItemText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Very small calendar modal to pick a single date (basic implementation)
  function CalendarModal({ 
    visible, 
    onClose, 
    onSelect 
  }: { 
    visible: boolean; 
    onClose: () => void; 
    onSelect: (d: Date) => void; 
  }) {
    const today = new Date();
    const [monthOffset, setMonthOffset] = useState(0);
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();

    // Compute days in month and weekday of first day
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
            <TouchableOpacity onPress={() => setMonthOffset((m) => m - 1)}>
              <Text style={stylesLocal.calendarNav}>‹</Text>
            </TouchableOpacity>
            <Text style={stylesLocal.calendarLabel}>{label}</Text>
            <TouchableOpacity onPress={() => setMonthOffset((m) => m + 1)}>
              <Text style={stylesLocal.calendarNav}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={stylesLocal.weekdaysRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={stylesLocal.weekday}>{d}</Text>
            ))}
          </View>
          <View>
            {weeks.map((week, idx) => (
              <View key={idx} style={stylesLocal.weekRow}>
                {week.map((day, dayIdx) => (
                  <TouchableOpacity
                    key={dayIdx}
                    style={day ? stylesLocal.dayBtn : stylesLocal.dayBtnEmpty}
                    onPress={() => {
                      if (day) {
                        const selected = new Date(year, month, day);
                        onSelect(selected);
                        onClose();
                      }
                    }}
                  >
                    {day && <Text style={stylesLocal.dayText}>{day}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    );
  }

  // Filtered list of payments (memoized)
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return SAMPLE_PAYMENTS.filter((payment) => {
      if (selectedCustomer && payment.customer !== selectedCustomer) return false;
      if (selectedStatus && payment.status !== selectedStatus) return false;
      if (selectedMethod && payment.method !== selectedMethod) return false;
      if (selectedDate) {
        const dLabel = formatDateLabel(selectedDate);
        if (payment.paymentDate !== dLabel) return false;
      }

      if (q) {
        // Match payment number, customer name, amount, or reference (case-insensitive)
        const paymentNo = payment.paymentNo.toLowerCase();
        const customer = payment.customer.toLowerCase();
        const amount = payment.amount.toLowerCase();
        const reference = payment.reference?.toLowerCase() || '';
        if (!paymentNo.includes(q) && !customer.includes(q) && !amount.includes(q) && !reference.includes(q)) return false;
      }

      return true;
    });
  }, [selectedCustomer, selectedStatus, selectedMethod, selectedDate, searchText]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
        <View style={[stylesLocal.headerWrap, stylesLocal.headerRow]}>
          <ThemedText type="defaultSemiBold" style={[stylesLocal.title, { color: text }]}>
            Manage Payments
          </ThemedText>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[stylesLocal.addButton, { backgroundColor: tint }]}
            accessibilityLabel="Add payment"
            onPress={() => console.log('Navigate to create payment')}
          >
            <ThemedText type="defaultSemiBold" style={stylesLocal.addButtonText}>+ Add Payment</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={stylesLocal.filtersFooter}>
          <View style={{ flex: 1 }} />
          <View style={stylesLocal.iconGroupCompact}>
            <TouchableOpacity 
              style={stylesLocal.iconCircle} 
              accessibilityLabel="Search" 
              onPress={() => { searchInputRef.current?.focus(); }}
            >
              <MaterialIcons name="search" size={resp.fontSize(16)} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={stylesLocal.filtersCompact}>
          <View style={stylesLocal.filtersGrid}>
            <TouchableOpacity style={stylesLocal.filterItem} onPress={() => setShowCustomerModal(true)}>
              <Text style={stylesLocal.filterText}>{selectedCustomer || 'Customer'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} onPress={() => setShowStatusModal(true)}>
              <Text style={stylesLocal.filterText}>{selectedStatus || 'Status'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} onPress={() => setShowMethodModal(true)}>
              <Text style={stylesLocal.filterText}>{selectedMethod || 'Method'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={stylesLocal.filterItem} onPress={() => setShowDateModal(true)}>
              <Text style={stylesLocal.filterText}>{formatDateLabel(selectedDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown / calendar modals */}
        <DropdownModal 
          visible={showCustomerModal} 
          title="Select customer" 
          options={customerOptions} 
          onClose={() => setShowCustomerModal(false)} 
          onSelect={(v) => setSelectedCustomer(v)} 
        />
        <DropdownModal 
          visible={showStatusModal} 
          title="Select status" 
          options={statusOptions} 
          onClose={() => setShowStatusModal(false)} 
          onSelect={(v) => setSelectedStatus(v as PaymentItem['status'])} 
        />
        <DropdownModal 
          visible={showMethodModal} 
          title="Select method" 
          options={methodOptions} 
          onClose={() => setShowMethodModal(false)} 
          onSelect={(v) => setSelectedMethod(v as PaymentItem['method'])} 
        />
        <CalendarModal 
          visible={showDateModal} 
          onClose={() => setShowDateModal(false)} 
          onSelect={(d) => setSelectedDate(d)} 
        />

        <View style={stylesLocal.controls}>
          <TextInput
            ref={searchInputRef}
            placeholder="Search payments..."
            placeholderTextColor={icon}
            style={stylesLocal.search}
            accessibilityLabel="Search payments"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <PaymentRow item={item} />}
          contentContainerStyle={{ paddingBottom: resp.vertical(30) }}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const createStyles = (
  resp: ReturnType<typeof useResponsive>, 
  theme: { bg: string; text: string; tint: string; icon: string }
) =>
  StyleSheet.create({
    container: { 
      flex: 1, 
      paddingVertical: resp.horizontalScale(16),
      paddingHorizontal: resp.horizontalScale(16),
      marginBottom: resp.vertical(20),
      backgroundColor: theme.bg 
    },
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
    filterIconBtn: { 
      width: resp.horizontalScale(40), 
      height: resp.horizontalScale(40), 
      borderRadius: resp.horizontalScale(6), 
      backgroundColor: '#00a3e0' 
    },
    iconGroup: { flexDirection: 'row' },
    controls: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: resp.vertical(12) 
    },
    entriesBox: { flexDirection: 'row', alignItems: 'center' },
    entriesText: { color: theme.text, fontSize: resp.fontSize(14) },
    search: { 
      flex: 1, 
      height: resp.vertical(40), 
      borderRadius: resp.horizontalScale(6), 
      borderWidth: 1, 
      borderColor: '#e6eaee', 
      paddingHorizontal: resp.horizontalScale(12) 
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      padding: resp.horizontalScale(12),
      borderRadius: resp.horizontalScale(8),
      marginBottom: resp.vertical(10),
    },
    invButton: { 
      borderWidth: 1, 
      borderColor: theme.tint, 
      paddingHorizontal: resp.horizontalScale(10), 
      paddingVertical: resp.vertical(6), 
      borderRadius: resp.horizontalScale(8) 
    },
    invButtonText: { color: theme.tint, fontWeight: '600', fontSize: resp.fontSize(13) },
    rowMain: { flex: 1, marginLeft: resp.horizontalScale(12) },
    customer: { fontSize: resp.fontSize(15), marginBottom: resp.vertical(6) },
    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaLabel: { color: '#8b9498', fontSize: resp.fontSize(13) },
    amount: { color: '#ff2d6f', fontWeight: '600', fontSize: resp.fontSize(13) },
    rowRight: { alignItems: 'flex-end' },
    statusBadge: { 
      paddingHorizontal: resp.horizontalScale(10), 
      paddingVertical: resp.vertical(6), 
      borderRadius: resp.horizontalScale(16), 
      marginBottom: resp.vertical(4) 
    },
    statusText: { color: '#fff', fontWeight: '600', fontSize: resp.fontSize(12) },
    methodBadge: { 
      paddingHorizontal: resp.horizontalScale(8), 
      paddingVertical: resp.vertical(4), 
      borderRadius: resp.horizontalScale(12), 
      marginBottom: resp.vertical(4) 
    },
    methodText: { color: '#fff', fontWeight: '500', fontSize: resp.fontSize(11) },
    actions: { flexDirection: 'row' },
    actionDot: { 
      width: resp.horizontalScale(28), 
      height: resp.horizontalScale(28), 
      borderRadius: resp.horizontalScale(6) 
    },
    // Card-like styles (mirrors the style used in app/(tabs)/invoice.tsx)
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
        ios: { 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 6 }, 
          shadowOpacity: 0.06, 
          shadowRadius: 12 
        },
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
    // Compact filter row styles
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
    iconCircle: { 
      width: resp.horizontalScale(20), 
      height: resp.horizontalScale(20), 
      borderRadius: resp.horizontalScale(10), 
      marginLeft: resp.horizontalScale(8) 
    },
    // Modal styles
    modalOverlay: { 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.35)' 
    },
    modalContent: { 
      position: 'absolute', 
      left: '6%', 
      right: '6%', 
      top: '25%', 
      maxHeight: '50%', 
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f', 
      borderRadius: resp.horizontalScale(10), 
      padding: resp.horizontalScale(12), 
      borderWidth: 1, 
      borderColor: '#e6eaee' 
    },
    modalTitle: { 
      fontSize: resp.fontSize(16), 
      marginBottom: resp.vertical(6), 
      color: theme.text, 
      fontWeight: '700' 
    },
    modalItem: { 
      paddingVertical: resp.vertical(10), 
      borderBottomWidth: 1, 
      borderBottomColor: '#e6eaee' 
    },
    modalItemText: { color: theme.text },
    // Calendar styles
    calendarContainer: { 
      position: 'absolute', 
      left: '6%', 
      right: '6%', 
      top: '20%', 
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f', 
      borderRadius: resp.horizontalScale(10), 
      padding: resp.horizontalScale(12), 
      borderWidth: 1, 
      borderColor: '#e6eaee' 
    },
    calendarHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: resp.vertical(6) 
    },
    calendarNav: { fontSize: resp.fontSize(18), color: theme.text },
    calendarLabel: { fontSize: resp.fontSize(15), color: theme.text, fontWeight: '600' },
    weekdaysRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      marginBottom: resp.vertical(6) 
    },
    weekday: { width: resp.horizontalScale(36), textAlign: 'center', color: '#8f9598' },
    weekRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      marginBottom: resp.vertical(4) 
    },
    dayBtn: { 
      width: resp.horizontalScale(36), 
      height: resp.horizontalScale(36), 
      borderRadius: resp.horizontalScale(8), 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f3f6f8' 
    },
    dayBtnEmpty: { 
      width: resp.horizontalScale(36), 
      height: resp.horizontalScale(36), 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    dayText: { color: theme.text },
    filtersGrid: { 
      flexDirection: 'row', 
      flexWrap: 'wrap', 
      justifyContent: 'space-between' 
    },
    filtersFooter: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'flex-end', 
      paddingTop: resp.vertical(6) 
    },
    headerWrap: { paddingBottom: resp.vertical(6) },
    headerRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between' 
    },
    addButton: { 
      paddingVertical: resp.vertical(6), 
      paddingHorizontal: resp.horizontalScale(10), 
      borderRadius: resp.horizontalScale(8) 
    },
    addButtonText: { color: '#fff', fontSize: resp.fontSize(13) },
  });
