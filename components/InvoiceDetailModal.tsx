import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { invoiceService } from '@/services/invoiceService';
import { InvoiceDetailApi, InvoiceDetailItem, InvoicePayment, InvoiceTotals } from '@/types/invoice';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface InvoiceDetailModalProps {
  visible: boolean;
  invoiceId: string | number;
  mode: 'view' | 'edit'; // 'view' for eye icon, 'edit' for edit icon
  onClose: () => void;
  onEdit?: () => void; // Callback when edit button is pressed in view mode
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  visible,
  invoiceId,
  mode,
  onClose,
  onEdit,
}) => {
  const resp = useResponsive();
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetailApi | null>(null);
  const [items, setItems] = useState<InvoiceDetailItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [totals, setTotals] = useState<InvoiceTotals | null>(null);

  const styles = createStyles(resp, { bg, text, tint, icon });

  useEffect(() => {
    if (visible && invoiceId) {
      console.log('[InvoiceDetailModal] Opening modal for invoice:', invoiceId);
      loadInvoiceDetail();
    }
  }, [visible, invoiceId]);

  const loadInvoiceDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[InvoiceDetailModal] Loading invoice detail for:', invoiceId);
      const data = await invoiceService.getInvoiceDetail(invoiceId);
      console.log('[InvoiceDetailModal] Received data:', data);
      if (data) {
        setInvoice(data.invoice);
        setItems(data.items);
        setPayments(data.payments);
        setTotals(data.totals);
        setError(null);
      } else {
        setError('Invoice not found');
        setInvoice(null);
        setItems([]);
        setPayments([]);
        setTotals(null);
      }
    } catch (error: any) {
      console.error('[InvoiceDetailModal] Error loading invoice detail:', error);
      setError(error.message || 'Failed to load invoice');
      setInvoice(null);
      setItems([]);
      setPayments([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice || !totals) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={tint} />
              <ThemedText style={{ marginTop: 10 }}>Loading invoice details...</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={{ marginBottom: 10, color: '#ff4d6d', fontSize: resp.fontSize(14), fontWeight: '600' }}>
                Error
              </ThemedText>
              <ThemedText style={{ marginBottom: 20, textAlign: 'center' }}>
                {error}
              </ThemedText>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: tint }]} onPress={onClose}>
                <ThemedText style={styles.closeBtnText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <ThemedText>No invoice data available</ThemedText>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: tint }]} onPress={onClose}>
                <ThemedText style={styles.closeBtnText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case 1:
        return '#2ecc71'; // Paid - Green
      case 2:
        return '#3bb1b8'; // Partially Paid - Teal
      case 3:
      default:
        return '#f39c12'; // Unpaid - Orange
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1:
        return 'Paid';
      case 2:
        return 'Partially Paid';
      case 3:
      default:
        return 'Unpaid';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: icon }]}>
          <ThemedText type="defaultSemiBold" style={[styles.headerTitle, { color: text }]}>
            Invoice #{invoice.invoice_number}
          </ThemedText>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close modal">
            <MaterialIcons name="close" size={resp.fontSize(24)} color={text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
          {/* Invoice Header Info */}
          <ThemedView style={[styles.section, { backgroundColor: bg === Colors.light.background ? '#f9fafb' : '#0f0f0f' }]}>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.label, { color: icon }]}>Issue Date</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.value, { color: text }]}>
                  {formatDate(invoice.issue_date)}
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.label, { color: icon }]}>Due Date</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.value, { color: text }]}>
                  {formatDate(invoice.due_date)}
                </ThemedText>
              </View>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.label, { color: icon }]}>Status</ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(invoice.status)}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <ThemedText style={[styles.label, { color: icon }]}>Delivery</ThemedText>
                <ThemedText type="defaultSemiBold" style={[styles.value, { color: text }]}>
                  {invoice.delivery_status}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {/* Customer Info */}
          <ThemedView style={[styles.section, { backgroundColor: bg === Colors.light.background ? '#f9fafb' : '#0f0f0f' }]}>
            <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: text }]}>
              Customer
            </ThemedText>
            <ThemedText style={[styles.sectionContent, { color: text }]}>
              {invoice.customer_name}
            </ThemedText>
            {invoice.contact_number && (
              <ThemedText style={[styles.sectionContent, { color: icon }]}>
                {invoice.contact_number}
              </ThemedText>
            )}
            {invoice.address && (
              <ThemedText style={[styles.sectionContent, { color: icon }]}>
                {invoice.address}
              </ThemedText>
            )}
          </ThemedView>

          {/* Items */}
          <ThemedView style={[styles.section, { backgroundColor: bg === Colors.light.background ? '#f9fafb' : '#0f0f0f' }]}>
            <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: text }]}>
              Items ({items.length})
            </ThemedText>
            {items.map((item, idx) => (
              <View key={item.id || idx} style={[styles.itemRow, { borderBottomColor: icon }]}>
                <View style={styles.itemLeft}>
                  <ThemedText type="defaultSemiBold" style={[styles.itemDesc, { color: text }]}>
                    {item.description}
                  </ThemedText>
                  <ThemedText style={[styles.itemMeta, { color: icon }]}>
                    Qty: {item.quantity}
                  </ThemedText>
                </View>
                <View style={styles.itemRight}>
                  <ThemedText style={[styles.itemAmount, { color: text }]}>
                    {formatAmount(item.price)}
                  </ThemedText>
                  <ThemedText style={[styles.itemSubtotal, { color: icon }]}>
                    {formatAmount(item.subtotal)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ThemedView>

          {/* Payments */}
          {payments.length > 0 && (
            <ThemedView style={[styles.section, { backgroundColor: bg === Colors.light.background ? '#f9fafb' : '#0f0f0f' }]}>
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: text }]}>
                Payments ({payments.length})
              </ThemedText>
              {payments.map((payment, idx) => (
                <View key={payment.id || idx} style={[styles.paymentRow, { borderBottomColor: icon }]}>
                  <View>
                    <ThemedText style={[styles.paymentDate, { color: icon }]}>
                      {formatDate(payment.date)}
                    </ThemedText>
                    {payment.reference && (
                      <ThemedText style={[styles.paymentRef, { color: icon, fontSize: resp.fontSize(11) }]}>
                        {payment.reference}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="defaultSemiBold" style={[styles.paymentAmount, { color: text }]}>
                    {formatAmount(payment.amount)}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          )}

          {/* Totals */}
          <ThemedView style={[styles.totalsSection, { backgroundColor: tint, opacity: 0.95 }]}>
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Sub Total</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                {formatAmount(totals.sub_total)}
              </ThemedText>
            </View>
            {totals.discount > 0 && (
              <View style={styles.totalRow}>
                <ThemedText style={styles.totalLabel}>Discount</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                  -{formatAmount(totals.discount)}
                </ThemedText>
              </View>
            )}
            {totals.tax > 0 && (
              <View style={styles.totalRow}>
                <ThemedText style={styles.totalLabel}>Tax</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                  {formatAmount(totals.tax)}
                </ThemedText>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalRowBold]}>
              <ThemedText type="defaultSemiBold" style={styles.totalLabelBold}>
                Total
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.totalValueBold}>
                {formatAmount(totals.total)}
              </ThemedText>
            </View>
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Paid</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.totalValue, { color: '#2ecc71' }]}>
                {formatAmount(totals.paid)}
              </ThemedText>
            </View>
            <View style={styles.totalRow}>
              <ThemedText style={styles.totalLabel}>Due</ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.totalValue, { color: '#ff4d6d' }]}>
                {formatAmount(totals.due)}
              </ThemedText>
            </View>
          </ThemedView>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {mode === 'view' && onEdit && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: tint }]}
                onPress={() => {
                  onClose();
                  onEdit();
                }}
              >
                <MaterialIcons name="edit" size={resp.fontSize(16)} color="#fff" />
                <ThemedText style={styles.actionBtnText}>Edit Invoice</ThemedText>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.closeActionBtn, { backgroundColor: bg === Colors.light.background ? '#f0f0f0' : '#1a1a1a', borderColor: icon, borderWidth: 1 }]}
              onPress={onClose}
            >
              <ThemedText style={[styles.closeActionBtnText, { color: text }]}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(20),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(12),
      borderBottomWidth: 1,
    },
    headerTitle: {
      fontSize: resp.fontSize(18),
    },
    content: {
      flex: 1,
    },
    contentPadding: {
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(12),
    },
    section: {
      borderRadius: resp.horizontalScale(12),
      padding: resp.horizontalScale(14),
      marginBottom: resp.vertical(12),
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    infoItem: {
      width: '48%',
      marginBottom: resp.vertical(10),
    },
    label: {
      fontSize: resp.fontSize(12),
      marginBottom: resp.vertical(4),
    },
    value: {
      fontSize: resp.fontSize(14),
    },
    statusBadge: {
      paddingHorizontal: resp.horizontalScale(10),
      paddingVertical: resp.vertical(6),
      borderRadius: resp.horizontalScale(6),
      alignSelf: 'flex-start',
    },
    statusText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: resp.fontSize(12),
    },
    sectionTitle: {
      fontSize: resp.fontSize(15),
      marginBottom: resp.vertical(10),
    },
    sectionContent: {
      fontSize: resp.fontSize(14),
      marginBottom: resp.vertical(4),
      lineHeight: resp.vertical(20),
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: resp.vertical(10),
      borderBottomWidth: 1,
    },
    itemLeft: {
      flex: 1,
      paddingRight: resp.horizontalScale(10),
    },
    itemDesc: {
      fontSize: resp.fontSize(14),
      marginBottom: resp.vertical(4),
    },
    itemMeta: {
      fontSize: resp.fontSize(12),
    },
    itemRight: {
      alignItems: 'flex-end',
    },
    itemAmount: {
      fontSize: resp.fontSize(13),
      fontWeight: '600',
      marginBottom: resp.vertical(2),
    },
    itemSubtotal: {
      fontSize: resp.fontSize(12),
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: resp.vertical(10),
      borderBottomWidth: 1,
    },
    paymentDate: {
      fontSize: resp.fontSize(13),
    },
    paymentRef: {
      marginTop: resp.vertical(2),
    },
    paymentAmount: {
      fontSize: resp.fontSize(14),
    },
    totalsSection: {
      borderRadius: resp.horizontalScale(12),
      padding: resp.horizontalScale(14),
      marginBottom: resp.vertical(12),
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: resp.vertical(8),
    },
    totalRowBold: {
      paddingVertical: resp.vertical(10),
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.2)',
      marginVertical: resp.vertical(4),
    },
    totalLabel: {
      color: '#fff',
      fontSize: resp.fontSize(13),
    },
    totalLabelBold: {
      color: '#fff',
      fontSize: resp.fontSize(14),
    },
    totalValue: {
      color: '#fff',
      fontSize: resp.fontSize(13),
    },
    totalValueBold: {
      color: '#fff',
      fontSize: resp.fontSize(14),
    },
    actionButtons: {
      flexDirection: 'column',
      gap: resp.vertical(10),
      paddingHorizontal: 0,
      marginBottom: resp.vertical(20),
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: resp.vertical(12),
      paddingHorizontal: resp.horizontalScale(16),
      borderRadius: resp.horizontalScale(10),
      gap: resp.horizontalScale(8),
    },
    actionBtnText: {
      color: '#fff',
      fontSize: resp.fontSize(14),
      fontWeight: '600',
    },
    closeActionBtn: {
      backgroundColor: 'transparent',
    },
    closeActionBtnText: {
      fontSize: resp.fontSize(14),
      fontWeight: '600',
    },
    closeBtn: {
      paddingVertical: resp.vertical(10),
      paddingHorizontal: resp.horizontalScale(20),
      borderRadius: resp.horizontalScale(8),
      marginTop: resp.vertical(20),
    },
    closeBtnText: {
      color: '#fff',
      fontWeight: '600',
    },
  });
