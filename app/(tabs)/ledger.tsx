import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
// fallback: useResponsive hook may not exist in the project; define a local implementation below
import { useThemeColor } from '@/hooks/use-theme-color';
import { AntDesign, Feather, MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Local fallback implementation for useResponsive (used when '@/hooks/use-responsive' is not available)
const useResponsive = () => {
  const guidelineBaseWidth = 375;
  const guidelineBaseHeight = 812;

  const horizontalScale = (size: number) => (width / guidelineBaseWidth) * size;
  const verticalScale = (size: number) => (height / guidelineBaseHeight) * size;
  const fontSize = (size: number) => Math.round(horizontalScale(size));

  return { horizontalScale, verticalScale, fontSize };
};

// Sample accounts
const ACCOUNT_LIST = [
  { id: '1', code: '1065', name: 'Petty Cash' },
  { id: '2', code: '1001', name: 'Cash in Hand' },
  { id: '3', code: '2001', name: 'Bank Account - SBI' },
  { id: '4', code: '4001', name: 'Sales' },
  { id: '5', code: '5001', name: 'Purchases' },
];

// Sample ledger entries
const LEDGER_ENTRIES = [
  {
    id: '1',
    date: 'Jan 12, 2025',
    voucherNo: 'VOU001',
    description: 'Office Supplies',
    debit: '0.00',
    credit: '1,250.00',
    balance: '1,250.00',
  },
  {
    id: '2',
    date: 'Jan 15, 2025',
    voucherNo: 'VOU002',
    description: 'Transportation',
    debit: '0.00',
    credit: '750.00',
    balance: '2,000.00',
  },
  {
    id: '3',
    date: 'Jan 20, 2025',
    voucherNo: 'VOU003',
    description: 'Petty Cash Replenishment',
    debit: '2,000.00',
    credit: '0.00',
    balance: '0.00',
  },
  {
    id: '4',
    date: 'Feb 05, 2025',
    voucherNo: 'VOU004',
    description: 'Stationery Purchase',
    debit: '0.00',
    credit: '350.00',
    balance: '350.00',
  },
  {
    id: '5',
    date: 'Feb 10, 2025',
    voucherNo: 'VOU005',
    description: 'Refreshments',
    debit: '0.00',
    credit: '200.00',
    balance: '550.00',
  },
];

export default function Ledger() {
  const resp = useResponsive();
  // useThemeColor will pick the right color from Colors.light/dark
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  const [selectedAccount, setSelectedAccount] = useState(ACCOUNT_LIST[0]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const [startDate, setStartDate] = useState('01/12/2025');
  const [endDate, setEndDate] = useState('04/12/2025');
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);

  const filteredAccounts = ACCOUNT_LIST.filter(
    (acc) =>
      acc.code.includes(accountSearch) ||
      acc.name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  // Format date for display
  const formatDateLabel = (dateString: string) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Account modal component
  function AccountModal({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (account: { id: string; code: string; name: string }) => void; }) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={stylesLocal.modalOverlay} onPress={onClose} activeOpacity={1} />
        <View style={stylesLocal.modalContent}>
          <View style={stylesLocal.modalHeader}>
            <Text style={stylesLocal.modalTitle}>Select Account</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={resp.fontSize(24)} color={text} />
            </TouchableOpacity>
          </View>

          <View style={stylesLocal.searchContainer}>
            <MaterialIcons name="search" size={resp.fontSize(18)} color={icon} style={stylesLocal.searchIcon} />
            <TextInput
              style={stylesLocal.searchInput}
              placeholder="Search account code or name..."
              placeholderTextColor={icon}
              value={accountSearch}
              onChangeText={setAccountSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredAccounts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={stylesLocal.accountItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                  setAccountSearch('');
                }}
              >
                <Text style={stylesLocal.accountCode}>{item.code}</Text>
                <Text style={stylesLocal.accountName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    );
  }

  // Simple calendar modal for date selection
  function CalendarModal({ visible, onClose, onSelect, currentDate }: { visible: boolean; onClose: () => void; onSelect: (d: Date) => void; currentDate: string; }) {
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
        <TouchableOpacity style={stylesLocal.modalOverlay} onPress={onClose} activeOpacity={1} />
        <View style={stylesLocal.calendarContainer}>
          <View style={stylesLocal.calendarHeader}>
            <TouchableOpacity onPress={() => setMonthOffset((m) => m - 1)}>
              <Text style={stylesLocal.calendarNav}>◀</Text>
            </TouchableOpacity>
            <Text style={stylesLocal.calendarLabel}>{label}</Text>
            <TouchableOpacity onPress={() => setMonthOffset((m) => m + 1)}>
              <Text style={stylesLocal.calendarNav}>▶</Text>
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

  // Ledger Entry Card Component
  function LedgerEntryCard({ entry }: { entry: typeof LEDGER_ENTRIES[0] }) {
    return (
      <TouchableOpacity 
        style={stylesLocal.card} 
        activeOpacity={0.9}
      >
        <View style={stylesLocal.cardHeader}>
          <View style={stylesLocal.cardLeft}>
            <Text style={stylesLocal.cardDate}>{entry.date}</Text>
            <Text style={stylesLocal.cardVoucher}>{entry.voucherNo}</Text>
          </View>
          <View style={stylesLocal.cardRight}>
            <Text style={stylesLocal.cardBalance}>{entry.balance}</Text>
          </View>
        </View>
        
        <View style={stylesLocal.cardDescription}>
          <Text style={stylesLocal.cardDescriptionText}>{entry.description}</Text>
        </View>
        
        <View style={stylesLocal.cardAmounts}>
          <View style={stylesLocal.amountBlock}>
            <Text style={stylesLocal.amountLabel}>Debit</Text>
            <Text style={stylesLocal.amountValue}>{entry.debit}</Text>
          </View>
          <View style={stylesLocal.amountBlock}>
            <Text style={stylesLocal.amountLabel}>Credit</Text>
            <Text style={stylesLocal.amountValue}>{entry.credit}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={stylesLocal.header}>
          {/* First Row: Account Dropdown (Full Width) */}
          <View style={stylesLocal.accountRow}>
            <Text style={stylesLocal.label}>Account</Text>
            <TouchableOpacity
              style={stylesLocal.dropdown}
              onPress={() => setShowAccountModal(true)}
            >
              <Text style={stylesLocal.dropdownText}>
                {selectedAccount.code} ({selectedAccount.name})
              </Text>
              <AntDesign name="down" size={resp.fontSize(16)} color={icon} />
            </TouchableOpacity>
          </View>

          {/* Second Row: Date Inputs and Submit Button */}
          <View style={stylesLocal.dateRow}>
            <View style={stylesLocal.dateField}>
              <Text style={stylesLocal.label}>Start Date</Text>
              <TouchableOpacity
                  style={[stylesLocal.dateInput, stylesLocal.validInput]}
                  onPress={() => setShowStartDateModal(true)}
                >
                  <Text style={stylesLocal.dateTextInput}>
                    {formatDateLabel(startDate)}
                  </Text>
                  <MaterialIcons name="check-circle" size={resp.fontSize(18)} color="#4CAF50" />
                </TouchableOpacity>
            </View>

            <View style={stylesLocal.dateField}>
              <Text style={stylesLocal.label}>End Date</Text>
              <TouchableOpacity
                  style={[stylesLocal.dateInput, stylesLocal.validInput]}
                  onPress={() => setShowEndDateModal(true)}
                >
                  <Text style={stylesLocal.dateTextInput}>
                    {formatDateLabel(endDate)}
                  </Text>
                  <MaterialIcons name="check-circle" size={resp.fontSize(18)} color="#4CAF50" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={[stylesLocal.submitButton, { backgroundColor: tint }]}>
              <Text style={stylesLocal.submitText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Print Button */}
        <View style={stylesLocal.printSection}>
          <TouchableOpacity style={[stylesLocal.printButton, { backgroundColor: tint }]}>
            <Text style={stylesLocal.printButtonText}>Print</Text>
            <Feather name="printer" size={resp.fontSize(20)} color="#fff" style={{ marginLeft: resp.horizontalScale(8) }} />
          </TouchableOpacity>
        </View>

        {/* Opening Balance */}
        <View style={stylesLocal.balanceSection}>
          <Text style={[stylesLocal.openingBalanceText, { color: text }]}>Opening Balance: 0</Text>
          <TouchableOpacity style={[stylesLocal.addPaymentButton, { backgroundColor: tint }]}>
            <Text style={stylesLocal.addPaymentText}>Add Payment</Text>
          </TouchableOpacity>
        </View>

        {/* Cards List */}
        <View style={stylesLocal.cardsContainer}>
          {/* Opening Balance Card */}
          <View style={stylesLocal.card}>
            <View style={stylesLocal.cardHeader}>
              <View style={stylesLocal.cardLeft}>
                <Text style={stylesLocal.cardDate}>Opening Balance</Text>
              </View>
              <View style={stylesLocal.cardRight}>
                <Text style={stylesLocal.cardBalance}>0.00</Text>
              </View>
            </View>
          </View>

          {/* Ledger Entry Cards */}
          <FlatList
            data={LEDGER_ENTRIES}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <LedgerEntryCard entry={item} />}
            contentContainerStyle={stylesLocal.cardsList}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Account Search Modal */}
        <AccountModal 
          visible={showAccountModal} 
          onClose={() => setShowAccountModal(false)} 
          onSelect={setSelectedAccount} 
        />

        {/* Date Picker Modals */}
        <CalendarModal 
          visible={showStartDateModal} 
          onClose={() => setShowStartDateModal(false)} 
          onSelect={(date) => setStartDate(date.toISOString().split('T')[0])}
          currentDate={startDate}
        />
        
        <CalendarModal 
          visible={showEndDateModal} 
          onClose={() => setShowEndDateModal(false)} 
          onSelect={(date) => setEndDate(date.toISOString().split('T')[0])}
          currentDate={endDate}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: theme.bg 
    },
    header: { 
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      padding: resp.horizontalScale(16), 
      borderBottomWidth: 1, 
      borderBottomColor: theme.bg === Colors.light.background ? '#e0e0e0' : '#1a1a1a',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        android: { elevation: 2 },
      }),
    },
    accountRow: { 
      marginBottom: resp.verticalScale(16) 
    },
    dateRow: { 
      flexDirection: 'row', 
      alignItems: 'flex-end',
      gap: resp.horizontalScale(12) 
    },
    label: { 
      fontSize: resp.fontSize(12), 
      color: theme.icon, 
      marginBottom: resp.verticalScale(6), 
      fontWeight: '600' 
    },
    dropdown: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#ddd' : '#333',
      borderRadius: resp.horizontalScale(6),
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.verticalScale(12),
      backgroundColor: theme.bg === Colors.light.background ? '#f9f9f9' : '#1a1a1a',
    },
    dropdownText: { 
      fontSize: resp.fontSize(15), 
      color: theme.text 
    },
    dateField: { flex: 1 },
    dateInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: resp.horizontalScale(6),
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.verticalScale(10),
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
    },
    validInput: { borderColor: '#4CAF50' },
    dateTextInput: { 
      fontSize: resp.fontSize(15), 
      color: theme.text, 
      flex: 1 
    },
    submitButton: {
      paddingHorizontal: resp.horizontalScale(28),
      paddingVertical: resp.verticalScale(12),
      borderRadius: resp.horizontalScale(6),
      height: resp.verticalScale(44),
      justifyContent: 'center',
    },
    submitText: { 
      color: '#fff', 
      fontWeight: '600', 
      fontSize: resp.fontSize(15) 
    },
    printSection: { 
      padding: resp.horizontalScale(16), 
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#e0e0e0' : '#1a1a1a',
    },
    printButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.verticalScale(10),
      borderRadius: resp.horizontalScale(6),
      alignSelf: 'flex-end',
    },
    printButtonText: { 
      color: '#fff', 
      fontWeight: '600', 
      fontSize: resp.fontSize(15) 
    },
    balanceSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: resp.horizontalScale(16),
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#eee' : '#1a1a1a',
    },
    openingBalanceText: { 
      fontSize: resp.fontSize(16), 
      fontWeight: '600' 
    },
    addPaymentButton: {
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.verticalScale(10),
      borderRadius: resp.horizontalScale(6),
    },
    addPaymentText: { 
      color: '#fff', 
      fontWeight: '600',
      fontSize: resp.fontSize(15)
    },
    
    // Cards Container
    cardsContainer: {
      flex: 1,
      padding: resp.horizontalScale(16),
    },
    cardsList: {
      paddingBottom: resp.verticalScale(20),
    },
    
    // Card Styles
    card: {
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      borderRadius: resp.horizontalScale(12),
      padding: resp.horizontalScale(16),
      marginBottom: resp.verticalScale(12),
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        android: { elevation: 2 },
      }),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#f0f4f6' : '#1a1a1a',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: resp.verticalScale(8),
    },
    cardLeft: {
      flexDirection: 'column',
    },
    cardRight: {
      alignItems: 'flex-end',
    },
    cardDate: {
      fontSize: resp.fontSize(14),
      fontWeight: '600',
      color: theme.text,
    },
    cardVoucher: {
      fontSize: resp.fontSize(12),
      color: theme.icon,
      marginTop: resp.verticalScale(2),
    },
    cardBalance: {
      fontSize: resp.fontSize(16),
      fontWeight: '700',
      color: theme.tint,
    },
    cardDescription: {
      marginBottom: resp.verticalScale(12),
    },
    cardDescriptionText: {
      fontSize: resp.fontSize(14),
      color: theme.text,
    },
    cardAmounts: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    amountBlock: {
      alignItems: 'center',
    },
    amountLabel: {
      fontSize: resp.fontSize(12),
      color: theme.icon,
      marginBottom: resp.verticalScale(4),
    },
    amountValue: {
      fontSize: resp.fontSize(14),
      fontWeight: '600',
      color: theme.text,
    },

    // Modal
    modalOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      justifyContent: 'flex-end' 
    },
    modalContent: {
      backgroundColor: theme.bg === Colors.light.background ? '#fff' : '#0f0f0f',
      borderTopLeftRadius: resp.horizontalScale(20),
      borderTopRightRadius: resp.horizontalScale(20),
      maxHeight: '80%',
      paddingBottom: resp.verticalScale(20),
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        android: { elevation: 4 },
      }),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: resp.horizontalScale(20),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#eee' : '#1a1a1a',
    },
    modalTitle: { 
      fontSize: resp.fontSize(18), 
      fontWeight: '600',
      color: theme.text
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: resp.horizontalScale(20),
      marginVertical: resp.verticalScale(10),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#ddd' : '#333',
      borderRadius: resp.horizontalScale(10),
      paddingHorizontal: resp.horizontalScale(12),
      backgroundColor: theme.bg === Colors.light.background ? '#f9f9f9' : '#1a1a1a',
    },
    searchIcon: { marginRight: resp.horizontalScale(8) },
    searchInput: {
      flex: 1,
      padding: resp.verticalScale(14),
      fontSize: resp.fontSize(16),
      color: theme.text,
    },
    accountItem: { 
      padding: resp.horizontalScale(16), 
      borderBottomWidth: 1, 
      borderBottomColor: theme.bg === Colors.light.background ? '#f0f0f0' : '#1a1a1a' 
    },
    accountCode: { 
      fontWeight: 'bold', 
      fontSize: resp.fontSize(15),
      color: theme.text
    },
    accountName: { 
      color: theme.icon, 
      marginTop: resp.verticalScale(4),
      fontSize: resp.fontSize(14)
    },
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
      borderColor: theme.bg === Colors.light.background ? '#e6eaee' : '#333',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
        android: { elevation: 8 },
      }),
    },
    calendarHeader: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: resp.verticalScale(6) 
    },
    calendarNav: { 
      fontSize: resp.fontSize(18), 
      color: theme.text 
    },
    calendarLabel: { 
      fontSize: resp.fontSize(15), 
      color: theme.text, 
      fontWeight: '600' 
    },
    weekdaysRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      marginBottom: resp.verticalScale(6) 
    },
    weekday: { 
      width: resp.horizontalScale(36), 
      textAlign: 'center', 
      color: theme.icon 
    },
    weekRow: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      marginBottom: resp.verticalScale(4) 
    },
    dayBtn: { 
      width: resp.horizontalScale(36), 
      height: resp.horizontalScale(36), 
      borderRadius: resp.horizontalScale(8), 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: theme.bg === Colors.light.background ? '#f3f6f8' : '#1a1a1a' 
    },
    dayBtnEmpty: { 
      width: resp.horizontalScale(36), 
      height: resp.horizontalScale(36), 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    dayText: { 
      color: theme.text 
    },
  });