import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Sample invoice detail data (matches design image)
const SAMPLE = {
  invoiceNo: '#INVO00003',
  issueDate: 'Sep 21, 2025',
  dueDate: 'Sep 21, 2025',
  billedTo: ['Yasir Foam Center', 'Abdul Road, Multan', 'Multan, Punjab, 60000', 'Pakistan'],
  status: 'Partially Paid',
  deliveryStatus: 'Out for delivery',
  products: [
    { id: '1', product: 'Moltly Foam (66 x 22 x 4)', shop: 'MASHAALLAH FOAM ABDALI ROAD', qty: '1 (Piece)', rate: '4,091.00 Rs.', tax: '-', desc: 'after tax & discount', price: '3,640.99 Rs.' },
    { id: '2', product: 'Moltly Foam (22 x 22 x 4)', shop: 'MASHAALLAH FOAM ABDALI ROAD', qty: '5 (Piece)', rate: '1,361.00 Rs.', tax: '-', desc: '', price: '6,805.45 Rs.' },
    { id: '3', product: 'Moltly Foam (78 x 72 x 6)', shop: "Anas Foam House", qty: '1 (Piece)', rate: '40,000.00 Rs.', tax: '-', desc: '', price: '35,600.00 Rs.' },
  ],
  subtotal: '50,896.00 Rs.',
  discount: '5,598.56 Rs.',
  total: '45,297.44 Rs.',
  paid: '0.00 Rs.',
  due: '45,297.44 Rs.',
};

export default function InvoiceDetail() {
  const resp = useResponsive();
  const theme = {
    bg: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    tint: useThemeColor({}, 'tint'),
    icon: useThemeColor({}, 'icon'),
  };

  const styles = createStyles(resp, theme);
  const router = useRouter();
  // we accept an id param but use SAMPLE static data for now
  const params = useLocalSearchParams();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ThemedView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header with back button and title */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityLabel="Back"
            accessibilityHint="Go back"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back" size={resp.fontSize(24)} color={theme.icon} />
          </TouchableOpacity>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Invoice Details</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Action buttons */}
        <View style={styles.actionButtonsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionButtonsScroll}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]}>
              <MaterialIcons name="send" size={resp.fontSize(16)} color="#3498db" />
              <ThemedText style={[styles.actionBtnText, { color: '#3498db' }]}>Send</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]}>
              <MaterialIcons name="payment" size={resp.fontSize(16)} color="#27ae60" />
              <ThemedText style={[styles.actionBtnText, { color: '#27ae60' }]}>Payment</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]}>
              <MaterialIcons name="download" size={resp.fontSize(16)} color="#f39c12" />
              <ThemedText style={[styles.actionBtnText, { color: '#f39c12' }]}>Download</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]}>
              <MaterialIcons name="print" size={resp.fontSize(16)} color="#fff" />
              <ThemedText style={[styles.actionBtnText, { color: '#fff' }]}>Print</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: resp.vertical(40) }}>

          {/* Invoice card */}
          <View style={styles.invoiceCardWrapper}>
            <ThemedView style={[styles.invoiceCard, { backgroundColor: theme.bg === '#fff' ? '#fff' : '#0a0a0a' }]}>
              <View style={styles.invoiceHeader}>
                <View style={styles.leftHeader}>
                  <ThemedText type="defaultSemiBold" style={[styles.h1, { color: theme.text }]}>{SAMPLE.invoiceNo}</ThemedText>
                  <ThemedText style={styles.hMeta}>Issue Date: {SAMPLE.issueDate}</ThemedText>
                  <ThemedText style={styles.hMeta}>Due Date: {SAMPLE.dueDate}</ThemedText>
                </View>

                <View style={styles.rightHeader}>
                  {/* QR placeholder */}
                  <View style={styles.qrBox} accessibilityRole="image">
                    <ThemedText style={{ textAlign: 'center', color: theme.text }}>QR</ThemedText>
                  </View>
                </View>
              </View>

              <View style={styles.addressRow}>
                <View style={styles.billCol}>
                  <ThemedText type="defaultSemiBold">Billed To:</ThemedText>
                  {SAMPLE.billedTo.map((l, idx) => (
                    <ThemedText key={idx} style={styles.billText}>{l}</ThemedText>
                  ))}

                  <View style={styles.statusRow}>
                    <View style={styles.statusPill}>
                      <ThemedText style={{ color: '#fff', fontSize: resp.fontSize(12), fontWeight: '600' }}>
                        {SAMPLE.status}
                      </ThemedText>
                    </View>
                    <View style={styles.deliveryPill}>
                      <ThemedText style={{ color: '#000', fontSize: resp.fontSize(12), fontWeight: '600' }}>
                        {SAMPLE.deliveryStatus}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              {/* Product summary table header */}
              <View style={styles.tableHeaderRow}>
                <ThemedText type="defaultSemiBold">Product Summary</ThemedText>
                <ThemedText style={styles.smallMuted}>All items here cannot be deleted.</ThemedText>
              </View>

              <View style={[styles.tableWrap, { backgroundColor: theme.bg === '#fff' ? '#fff' : 'transparent' }]}>
                {SAMPLE.products.map((p, idx) => (
                  <View key={p.id} style={styles.productItem}>
                    <View style={styles.productHeader}>
                      <View style={styles.productLeft}>
                        <ThemedText type="defaultSemiBold" style={styles.productName} numberOfLines={2}>{p.product}</ThemedText>
                        <ThemedText style={styles.shopName} numberOfLines={1}>{p.shop}</ThemedText>
                      </View>
                      <ThemedText type="defaultSemiBold" style={styles.productPrice}>{p.price}</ThemedText>
                    </View>
                    <View style={styles.productDetails}>
                      <View style={styles.productDetailItem}>
                        <ThemedText style={styles.detailLabel}>Qty:</ThemedText>
                        <ThemedText style={styles.detailValue}>{p.qty}</ThemedText>
                      </View>
                      <View style={styles.productDetailItem}>
                        <ThemedText style={styles.detailLabel}>Rate:</ThemedText>
                        <ThemedText style={styles.detailValue}>{p.rate}</ThemedText>
                      </View>
                      {p.desc && (
                        <View style={styles.productDetailItem}>
                          <ThemedText style={styles.detailLabel}>Note:</ThemedText>
                          <ThemedText style={styles.detailValue}>{p.desc}</ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                {/* totals area */}
                <View style={styles.totalsRow}>
                  <View style={styles.totalsLeft} />
                  <View style={styles.totalsRight}>
                    <View style={styles.totLine}>
                      <ThemedText style={styles.totLabel}>Sub Total</ThemedText>
                      <ThemedText style={styles.totValue}>{SAMPLE.subtotal}</ThemedText>
                    </View>
                    <View style={styles.totLine}>
                      <ThemedText style={styles.totLabel}>Discount</ThemedText>
                      <ThemedText style={[styles.totValue, { color: '#dc3545' }]}>-{SAMPLE.discount}</ThemedText>
                    </View>
                    <View style={[styles.totLine, styles.totLineTotal]}>
                      <ThemedText style={styles.totLabelTotal}>Total</ThemedText>
                      <ThemedText style={styles.totValueTotal}>{SAMPLE.total}</ThemedText>
                    </View>
                    <View style={styles.totLine}>
                      <ThemedText style={styles.totLabel}>Paid</ThemedText>
                      <ThemedText style={[styles.totValue, { color: '#28a745' }]}>{SAMPLE.paid}</ThemedText>
                    </View>
                    <View style={styles.totLine}>
                      <ThemedText style={styles.totLabel}>Due</ThemedText>
                      <ThemedText style={[styles.totValue, { color: '#dc3545', fontWeight: '700' }]}>{SAMPLE.due}</ThemedText>
                    </View>
                  </View>
                </View>
              </View>

            </ThemedView>
          </View>

          {/* Receipt summary & bottom action */}
          <View style={styles.receiptWrap}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: resp.fontSize(18), marginBottom: resp.vertical(12) }}>
              Payment History
            </ThemedText>
            <View style={styles.receiptTable}>
              <MaterialIcons name="receipt-long" size={resp.fontSize(32)} color="#6c757d" />
              <ThemedText style={[styles.smallMuted, { marginTop: resp.vertical(8), textAlign: 'center' }]}>
                No payments received yet
              </ThemedText>
              <ThemedText style={[styles.smallMuted, { textAlign: 'center', fontSize: resp.fontSize(11) }]}>
                Payments will appear here once received
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        {/* <TouchableOpacity 
          style={styles.fab} 
          accessibilityLabel="Create New Invoice" 
          onPress={() => router.push('/(tabs)/invoice')}
        >
          <MaterialIcons name="add" size={resp.fontSize(20)} color="#fff" />
          <ThemedText style={{ color: '#fff', fontWeight: '600', marginLeft: resp.horizontalScale(8) }}>
            New Invoice
          </ThemedText>
        </TouchableOpacity> */}
      </ThemedView>
    </SafeAreaView>
  );
}

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: { flex: 1, padding: resp.horizontalScale(16),
        marginBottom: resp.vertical(20)
     },
    
    // Header styles
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: resp.vertical(12),
      marginBottom: resp.vertical(8),
    },
    backBtn: {
      padding: resp.horizontalScale(8),
      borderRadius: resp.horizontalScale(8),
    },
    headerTitle: {
      fontSize: resp.fontSize(18),
      fontWeight: '600',
      color: theme.text,
    },
    headerSpacer: {
      width: resp.horizontalScale(40),
    },

    // Action buttons
    actionButtonsContainer: {
      marginBottom: resp.vertical(16),
    },
    actionButtonsScroll: {
      paddingHorizontal: resp.horizontalScale(4),
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(10),
      borderRadius: resp.horizontalScale(8),
      marginRight: resp.horizontalScale(8),
      gap: resp.horizontalScale(6),
    },
    actionBtnSecondary: {
      backgroundColor: '#f8f9fa',
      borderWidth: 1,
      borderColor: '#e9ecef',
    },
    actionBtnPrimary: {
      backgroundColor: '#007bff',
    },
    actionBtnText: {
      fontSize: resp.fontSize(14),
      fontWeight: '500',
    },

    // Invoice card
    invoiceCardWrapper: { marginVertical: resp.vertical(8) },
    invoiceCard: {
      padding: resp.horizontalScale(16),
      borderRadius: resp.horizontalScale(12),
      backgroundColor: theme.bg === '#fff' ? '#fff' : '#1a1a1a',
      borderWidth: 1,
      borderColor: theme.bg === '#fff' ? '#e9ecef' : '#333',
      marginBottom: resp.vertical(12),
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    invoiceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: resp.vertical(16),
    },
    leftHeader: { flex: 1 },
    rightHeader: { marginLeft: resp.horizontalScale(16) },
    h1: {
      fontSize: resp.fontSize(24),
      fontWeight: '700',
      color: theme.text,
      marginBottom: resp.vertical(4),
    },
    hMeta: {
      color: '#6c757d',
      fontSize: resp.fontSize(14),
      marginBottom: resp.vertical(2),
    },
    qrBox: {
      width: resp.horizontalScale(64),
      height: resp.horizontalScale(64),
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: resp.horizontalScale(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
    },

    // Address and status
    addressRow: { marginBottom: resp.vertical(16) },
    billCol: { flex: 1 },
    billText: {
      marginTop: resp.vertical(2),
      color: theme.text,
      fontSize: resp.fontSize(14),
    },
    statusRow: {
      flexDirection: 'row',
      marginTop: resp.vertical(12),
      gap: resp.horizontalScale(8),
    },
    statusPill: {
      backgroundColor: '#28a745',
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.vertical(6),
      borderRadius: resp.horizontalScale(16),
    },
    deliveryPill: {
      backgroundColor: '#ffc107',
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.vertical(6),
      borderRadius: resp.horizontalScale(16),
    },

    // Product table
    tableHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: resp.vertical(12),
    },
    smallMuted: {
      color: '#6c757d',
      fontSize: resp.fontSize(12),
    },
    tableWrap: {
      borderTopWidth: 1,
      borderTopColor: '#dee2e6',
      paddingTop: resp.vertical(12),
    },

    // New product item styles
    productItem: {
      backgroundColor: theme.bg === '#fff' ? '#f8f9fa' : '#2a2a2a',
      borderRadius: resp.horizontalScale(8),
      padding: resp.horizontalScale(12),
      marginBottom: resp.vertical(8),
      borderWidth: 1,
      borderColor: theme.bg === '#fff' ? '#e9ecef' : '#444',
    },
    productHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: resp.vertical(8),
    },
    productLeft: {
      flex: 1,
      marginRight: resp.horizontalScale(12),
    },
    productName: {
      fontSize: resp.fontSize(15),
      fontWeight: '600',
      color: theme.text,
      marginBottom: resp.vertical(2),
    },
    shopName: {
      fontSize: resp.fontSize(13),
      color: '#6c757d',
      fontStyle: 'italic',
    },
    productPrice: {
      fontSize: resp.fontSize(16),
      fontWeight: '700',
      color: '#28a745',
    },
    productDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: resp.horizontalScale(16),
    },
    productDetailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: resp.fontSize(12),
      color: '#6c757d',
      marginRight: resp.horizontalScale(4),
      fontWeight: '500',
    },
    detailValue: {
      fontSize: resp.fontSize(12),
      color: theme.text,
      fontWeight: '600',
    },

    // Totals
    totalsRow: {
      flexDirection: 'row',
      marginTop: resp.vertical(16),
    },
    totalsLeft: { flex: 1 },
    totalsRight: {
      width: resp.horizontalScale(220),
      padding: resp.horizontalScale(16),
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: resp.horizontalScale(8),
      backgroundColor: theme.bg === '#fff' ? '#f8f9fa' : '#2a2a2a',
    },
    totLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: resp.vertical(8),
    },
    totLineTotal: {
      borderTopWidth: 1,
      borderTopColor: '#dee2e6',
      paddingTop: resp.vertical(8),
      marginTop: resp.vertical(4),
    },
    totLabel: {
      fontSize: resp.fontSize(14),
      color: '#6c757d',
    },
    totValue: {
      fontSize: resp.fontSize(14),
      color: theme.text,
      fontWeight: '500',
    },
    totLabelTotal: {
      fontSize: resp.fontSize(16),
      color: theme.text,
      fontWeight: '600',
    },
    totValueTotal: {
      fontSize: resp.fontSize(16),
      color: theme.text,
      fontWeight: '700',
    },

    // Receipt
    receiptWrap: { marginTop: resp.vertical(16) },
    receiptTable: {
      marginTop: resp.vertical(8),
      padding: resp.horizontalScale(16),
      borderRadius: resp.horizontalScale(8),
      borderWidth: 1,
      borderColor: '#dee2e6',
      backgroundColor: theme.bg === '#fff' ? '#f8f9fa' : '#2a2a2a',
      alignItems: 'center',
    },
    fab: {
      position: 'absolute',
      right: resp.horizontalScale(16),
      bottom: resp.vertical(24),
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#007bff',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(14),
      borderRadius: resp.horizontalScale(28),
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 6,
        },
      }),
    },

    // Legacy styles to remove later
    topRibbon: { marginBottom: resp.vertical(10) },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: resp.horizontalScale(8) },
    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: resp.vertical(8) },
    stepsActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: resp.horizontalScale(8) },
    stepsContainer: { flex: 1 },
    stepsScroll: { alignItems: 'center', paddingVertical: resp.vertical(4) },
    step: { minWidth: resp.horizontalScale(120), padding: resp.horizontalScale(8), marginRight: resp.horizontalScale(8), borderRadius: resp.horizontalScale(8), backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6eaee' },
    stepActive: { backgroundColor: '#f6fffb' },
    stepMuted: { backgroundColor: '#fff' },
    stepLabel: { fontSize: resp.fontSize(13) },
    stepMeta: { fontSize: resp.fontSize(11), color: '#6b6f73' },
    smallBtn: { marginTop: resp.vertical(6), paddingHorizontal: resp.horizontalScale(8), paddingVertical: resp.vertical(6), backgroundColor: '#e6f7ec', alignSelf: 'flex-start', borderRadius: resp.horizontalScale(6) },
    smallBtnAlt: { marginTop: resp.vertical(6), paddingHorizontal: resp.horizontalScale(8), paddingVertical: resp.vertical(6), backgroundColor: '#dff1f4', alignSelf: 'flex-start', borderRadius: resp.horizontalScale(6) },
    smallBtnText: { color: '#1b6e53' },
    smallBtnTextAlt: { color: '#0f5f5a' },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: resp.horizontalScale(8) },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: resp.vertical(6), borderBottomWidth: 1, borderBottomColor: '#f1f5f7' },
    tableHead: { backgroundColor: '#fbfdff' },
    colProduct: { width: resp.horizontalScale(36), fontSize: resp.fontSize(12) },
    colShop: { width: resp.horizontalScale(100), fontSize: resp.fontSize(12) },
    colQty: { width: resp.horizontalScale(64), fontSize: resp.fontSize(12) },
    colRate: { width: resp.horizontalScale(80), fontSize: resp.fontSize(12) },
    colTax: { width: resp.horizontalScale(56), fontSize: resp.fontSize(12) },
    colDesc: { width: resp.horizontalScale(80), fontSize: resp.fontSize(12) },
    colPrice: { width: resp.horizontalScale(90), textAlign: 'right', fontSize: resp.fontSize(12) },
  });
