import { InvoiceDetailModal } from '@/components/InvoiceDetailModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import useNetwork from '@/hooks/useNetwork';
import useResponsive from '@/hooks/useResponsive';
import { customerService } from '@/services/customerService';
import { invoiceService } from '@/services/invoiceService';
import localDB from '@/services/localDatabase';
import { Customer } from '@/types/customer';
import { Invoice } from '@/types/invoice';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type InvoiceItem = Invoice;

// We'll define row and badge components inside the main component so they can use
// responsive sizes and theme-aware colors from hooks.

export default function InvoiceScreen() {
  const resp = useResponsive();
  const router = useRouter();
  const { isConnected } = useNetwork();
  const { unsyncedCount: syncContextUnsyncedCount, isSyncing, syncNow } = useSync();
  // useThemeColor will pick the right color from Colors.light/dark
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  // Data state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const perPage = 10;

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

  // Detail Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [detailModalMode, setDetailModalMode] = useState<'view' | 'edit'>('view');

  // Load invoices from service with pagination
  const loadInvoices = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      console.log(`[Invoice Screen] Loading invoices (page ${page}, online: ${isConnected})...`);

      if (isConnected) {
        // Online: Fetch from backend with pagination
        const result = await invoiceService.getInvoices(page, perPage);
        console.log(`[Invoice Screen] Loaded ${result.invoices.length} invoices from backend (page ${page}/${result.totalPages})`);

        if (append) {
          setInvoices(prev => [...prev, ...result.invoices]);
        } else {
          setInvoices(result.invoices);
        }

        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
        setTotalInvoices(result.total);
      } else {
        // Offline: Show only unsynced invoices
        const result = await invoiceService.getInvoices(1, 100); // Get all unsynced
        console.log(`[Invoice Screen] Loaded ${result.invoices.length} unsynced invoices (offline mode)`);
        setInvoices(result.invoices);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalInvoices(result.invoices.length);
      }
    } catch (error) {
      console.error('[Invoice Screen] Failed to load invoices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [isConnected, perPage]);

  // Load customers from service
  const loadCustomers = useCallback(async () => {
    try {
      console.log('[Invoice Screen] Loading customers...');
      const data = await customerService.getAllCustomers();
      console.log(`[Invoice Screen] Loaded ${data.length} customers`);
      setCustomers(data);
    } catch (error) {
      console.error('[Invoice Screen] Failed to load customers:', error);
    }
  }, []);


  useFocusEffect(
    useCallback(() => {
      setCurrentPage(1);
      loadInvoices(1, false);
      // also refresh unsynced count when screen focuses
      (async () => {
        try {
          const unsynced = await localDB.getUnsyncedInvoices();
          setUnsyncedCount(unsynced.length);
        } catch (e) {
          console.warn('[Invoice Screen] Failed to get unsynced invoices count', e);
          setUnsyncedCount(0);
        }
      })();
      loadCustomers();
    }, [loadInvoices, loadCustomers])
  );

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    loadInvoices(1, false);
    loadCustomers();
  }, [loadInvoices, loadCustomers]);

  // Handle load more (pagination)
  const onLoadMore = useCallback(() => {
    // Prevent load more if searching or filtering (searchText or any filter is active)
    const isFiltering = !!searchText.trim() || selectedCustomer || selectedStatus || selectedShop || selectedDate;
    if (isFiltering) return;
    if (!isConnected || loadingMore || currentPage >= totalPages) {
      return;
    }
    const nextPage = currentPage + 1;
    console.log(`[Invoice Screen] Loading more invoices (page ${nextPage})`);
    loadInvoices(nextPage, true);
  }, [isConnected, loadingMore, currentPage, totalPages, loadInvoices, searchText, selectedCustomer, selectedStatus, selectedShop, selectedDate]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    try {
      await invoiceService.deleteInvoice(id);
      loadInvoices();
    } catch (error) {
      console.error('Failed to delete invoice:', error);
    }
  }, [loadInvoices]);

  // build unique lists from invoice data for dropdowns
  const customerOptions = useMemo(() => {
    // Get unique customer names from loaded customers
    const names = customers.map((c) => c.name).filter(Boolean);
    // Remove duplicates by using Set
    return Array.from(new Set(names));
  }, [customers]);
  const statusOptions: InvoiceItem['status'][] = ['Paid', 'Partially Paid', 'Unpaid'];
  const shopOptions = useMemo(() => Array.from(new Set(invoices.map((i) => i.warehouseName))).filter(Boolean) as string[], [invoices]);

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

    // Format amount with commas and Rs.
    const formatAmount = (amount: string) => {
      const num = parseFloat(amount);
      return `${num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;
    };

    // Format date to readable format
    const formatDate = (dateStr: string) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    const handleViewClick = () => {
      // Use serverId if available (for API calls), otherwise use id
      const invoiceId = item.serverId || item.id;
      console.log('[Invoice List] View clicked - ID:', invoiceId, 'serverId:', item.serverId, 'id:', item.id);
      setSelectedInvoiceId(invoiceId);
      setDetailModalMode('view');
      setDetailModalVisible(true);
    };

    const handleEditClick = () => {
      const invoiceId = item.serverId || item.id;
      console.log('[Invoice List] Edit clicked - ID:', invoiceId);
      // Navigate to edit page instead of opening modal
      router.push({
        pathname: '/(tabs)/invoice/edit/[id]',
        params: { id: invoiceId }
      });
    };

   const generatePdfAndShare = async (inv: InvoiceItem) => {
  let finalPdfUri = null;
  let professionalFilename = '';

  try {
    // Try to fetch detailed invoice (items/payments) from service
    const detailResult = await invoiceService.getInvoiceDetail(inv.serverId || inv.id);
    const items = detailResult?.items ?? [];
    const totals = detailResult?.totals ?? null;

    const formatNum = (n: number | string) => {
      const num = typeof n === 'number' ? n : parseFloat(String(n) || '0');
      return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const rowsHtml = items.map((it, idx) => {
      const desc = it.description || (it as any).sub_description || '-';
      const qty = it.quantity ?? 0;
      const rate = parseFloat(it.price as any || '0');
      const value = it.subtotal ?? Math.round(qty * rate);
      return `<tr><td style="padding:6px;border:1px solid #ddd">${idx + 1}</td><td style="padding:6px;border:1px solid #ddd">${desc}</td><td style="padding:6px;border:1px solid #ddd">${qty}</td><td style="padding:6px;border:1px solid #ddd">${formatNum(rate)}</td><td style="padding:6px;border:1px solid #ddd">${formatNum(value)}</td></tr>`;
    }).join('') || '<tr><td style="padding:6px;border:1px solid #ddd" colspan="5">No items</td></tr>';

    // Grand total: sum of per-line values
    const computedTotal = items.reduce((s: number, it: any) => {
      const qty = it.quantity ?? 0;
      const rate = parseFloat(it.price as any || '0');
      const value = it.subtotal ?? Math.round(qty * rate);
      return s + (isNaN(value) ? 0 : value);
    }, 0);

    const dueAmount = (totals && typeof totals.due === 'number') ? totals.due : parseFloat(inv.dueAmount || '0');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 18px; color: #222 }
            .header { text-align:center; margin-bottom:12px }
            .title { font-size:20px; font-weight:700 }
            .row { display:flex; justify-content:space-between; margin-top:8px }
            .table { width:100%; border-collapse: collapse; margin-top: 12px }
            .table th, .table td { border: 1px solid #ddd; padding: 6px; text-align: left }
            .totals { margin-top: 12px; text-align: right }
          </style>
        </head>
        <body>
          <div class="header"><div class="title">SALE INVOICE</div></div>
          <div class="row"><div><strong>Invoice #:</strong></div><div>${inv.invoiceNo}</div></div>
          <div class="row"><div><strong>Date:</strong></div><div>${new Date(inv.issueDate).toLocaleDateString()}</div></div>
          <div class="row"><div><strong>Customer:</strong></div><div>${inv.customerName}</div></div>
          <table class="table">
            <thead>
              <tr><th style="padding:6px">S#</th><th style="padding:6px">Product</th><th style="padding:6px">Qty</th><th style="padding:6px">Rate</th><th style="padding:6px">Total</th></tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div><strong>Due: ${formatNum(dueAmount)}</strong></div>
              <div><strong>Total: ${formatNum(computedTotal)}</strong></div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Step 1: Generate the PDF with a random temporary name
    const { uri } = await Print.printToFileAsync({ html });
    console.log('PDF generated at temporary path:', uri);
    finalPdfUri = uri; // By default, we'll use this URI

    // Step 2: Create a professional filename
    const sanitizeForFilename = (str: string) =>
      str
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .substring(0, 25); // Limit length

    const customerName = sanitizeForFilename(inv.customerName || 'Customer');
    const invoiceNo = sanitizeForFilename(inv.invoiceNo || 'Inv');
    professionalFilename = `Invoice_${invoiceNo}_${customerName}.pdf`;
    
    const destinationUri = `${FileSystem.documentDirectory}${professionalFilename}`;
    console.log(`Attempting to rename and copy to: ${destinationUri}`);

    // Step 3: Copy the file to the new destination with the new name
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });
    
    // If copy is successful, update the URI to the new, professionally named one
    finalPdfUri = destinationUri;
    console.log('Successfully renamed PDF to:', professionalFilename);

  } catch (error) {
    console.error('Error during PDF generation or renaming. Will share the original file.', error);
    // If an error occurs, finalPdfUri will remain the original random URI.
    // The sharing logic below will still work.
  }

  // Step 4: Share the PDF
  if (finalPdfUri) {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        alert('Sharing is not available on your device');
        return;
      }
      await Sharing.shareAsync(finalPdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: professionalFilename ? `Share: ${professionalFilename.replace('.pdf', '')}` : 'Share Invoice',
      });
      console.log('Shared PDF successfully.');
    } catch (shareError) {
      console.error('Failed to share PDF:', shareError);
      alert('Could not share the PDF.');
    }
  } else {
    alert('Could not generate the PDF for sharing.');
  }
};

    return (
      <View style={stylesLocal.rowWrapper}>
        <ThemedView style={[stylesLocal.card, { width: '100%' }]}>
          <View style={stylesLocal.left}>
            <TouchableOpacity style={stylesLocal.idChip} activeOpacity={0.85}>
              <ThemedText type="link" style={stylesLocal.idText}>
                {String(item.invoiceNo).slice(0, 12)}
              </ThemedText>
            </TouchableOpacity>

            <ThemedText type="defaultSemiBold" style={[stylesLocal.name, { color: text }]}>{item.customerName}</ThemedText>
            <ThemedText style={stylesLocal.meta}>{formatDate(item.issueDate)} · {item.dueDate ? formatDate(item.dueDate) : formatDate(item.issueDate)}</ThemedText>
          </View>

          <View style={stylesLocal.right}>
            <View style={stylesLocal.balanceBlock}>
              <ThemedText type="subtitle" style={stylesLocal.smallLabel}>Due Amount</ThemedText>
              <ThemedText type="defaultSemiBold" style={stylesLocal.balance}>{formatAmount(item.dueAmount)}</ThemedText>
            </View>

            <View style={stylesLocal.balanceBlock}>
              <StatusBadge status={item.status} />
            </View>

            <View style={stylesLocal.actions}>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#f9b233' }]}
                accessibilityLabel={`View ${item.invoiceNo}`}
                onPress={handleViewClick}
              >
                <MaterialIcons name="visibility" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#16a085' }]}
                onPress={handleEditClick}
                accessibilityLabel={`Edit ${item.invoiceNo}`}
              >
                <MaterialIcons name="edit" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#ff4d6d' }]}
                accessibilityLabel={`Delete ${item.invoiceNo}`}
                onPress={() => handleDelete(item.id)}
              >
                <MaterialIcons name="delete" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[stylesLocal.iconBtn, { backgroundColor: '#3498db' }]}
                accessibilityLabel={`Share ${item.invoiceNo}`}
                onPress={() => generatePdfAndShare(item)}
              >
                <MaterialIcons name="share" size={resp.fontSize(14)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </ThemedView>
      </View>
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
            {options.map((opt, index) => (
              <TouchableOpacity key={`${opt}-${index}`} style={stylesLocal.modalItem} onPress={() => { onSelect(opt); onClose(); }}>
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
    const filteredList = invoices.filter((inv) => {
      if (selectedCustomer && inv.customerName !== selectedCustomer) return false;
      if (selectedStatus && inv.status !== selectedStatus) return false;
      if (selectedShop && inv.warehouseName !== selectedShop) return false;
      if (selectedDate) {
        const dLabel = formatDateLabel(selectedDate);
        const invIssueDate = new Date(inv.issueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const invDueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : invIssueDate;
        if (invIssueDate !== dLabel && invDueDate !== dLabel) return false;
      }

      if (q) {
        // match invoice number, customer name or amount (case-insensitive, robust for numbers)
        const invoiceNo = (inv.invoiceNo ? String(inv.invoiceNo) : '').toLowerCase();
        const customer = (inv.customerName ? String(inv.customerName) : '').toLowerCase();
        const amount = (inv.dueAmount ? String(inv.dueAmount) : '').toLowerCase();
        // Also match formatted amount (with commas, decimals, etc.)
        const formattedAmount = (() => {
          const num = parseFloat(inv.dueAmount || '0');
          return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).toLowerCase();
        })();
        if (
          !invoiceNo.includes(q) &&
          !customer.includes(q) &&
          !amount.includes(q) &&
          !formattedAmount.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort: unsynced invoices first (by creation date desc), then synced invoices
    return filteredList.sort((a, b) => {
      // If offline mode, both are unsynced - sort by createdAt
      if (!isConnected) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }

      // Helper to get sync status (support both old synced field and new syncStatus field)
      const getSyncStatus = (invoice: any) => {
        if (invoice.syncStatus) return invoice.syncStatus;
        return invoice.synced === 0 ? 'UNSYNCED' : 'SYNCED';
      };

      const aStatus = getSyncStatus(a);
      const bStatus = getSyncStatus(b);

      // Priority order: UNSYNCED > FAILED > SYNCED
      const statusPriority: Record<string, number> = { UNSYNCED: 0, FAILED: 1, SYNCED: 2 };
      const aPriority = statusPriority[aStatus] ?? 2;
      const bPriority = statusPriority[bStatus] ?? 2;

      if (aPriority !== bPriority) return aPriority - bPriority;

      // If both have same sync status, sort by creation date (newest first)
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [selectedCustomer, selectedStatus, selectedShop, selectedDate, searchText, invoices, isConnected]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
        <View style={[stylesLocal.headerWrap, stylesLocal.headerRow]}>
          <View>
            <ThemedText type="defaultSemiBold" style={[stylesLocal.title, { color: text }]}>Manage Invoices</ThemedText>
            <View style={stylesLocal.headerBadges}>
              <View style={[stylesLocal.countBadge, { backgroundColor: tint }]}>
                <Text style={stylesLocal.countText}>Total: {totalInvoices}</Text>
              </View>
              <View style={[stylesLocal.countBadge, { backgroundColor: '#ff9800', marginLeft: resp.horizontalScale(8) }]}>
                <Text style={stylesLocal.countText}>Unsynced: {unsyncedCount}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'column', gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[stylesLocal.addButton, { backgroundColor: tint }]}
              accessibilityLabel="Create invoice"
              onPress={() => router.push('/(tabs)/invoice/create')}
            >
              <ThemedText type="defaultSemiBold" style={stylesLocal.addButtonText}>+ Create</ThemedText>
            </TouchableOpacity>

            {isConnected && unsyncedCount > 0 && (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[stylesLocal.addButton, { backgroundColor: '#27ae60', opacity: isSyncing ? 0.6 : 1 }]}
                accessibilityLabel="Sync unsynced invoices"
                disabled={isSyncing}
                onPress={() => syncNow()}
              >
                <ThemedText type="defaultSemiBold" style={stylesLocal.addButtonText}>
                  {isSyncing ? '⟳ Syncing...' : '⬆ Sync'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
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

        {/* Invoice Detail Modal */}
        {selectedInvoiceId && (
          <InvoiceDetailModal
            visible={detailModalVisible}
            invoiceId={selectedInvoiceId}
            mode={detailModalMode}
            onClose={() => setDetailModalVisible(false)}
            onEdit={() => {
              setDetailModalVisible(false);
              // Navigate to edit page after short delay
              setTimeout(() => {
                router.push({ pathname: '/(tabs)/invoice/edit/[id]', params: { id: selectedInvoiceId } });
              }, 300);
            }}
          />
        )}

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

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={tint} />
            <ThemedText style={{ marginTop: 10 }}>
              {isConnected ? 'Loading invoices...' : 'Loading unsynced invoices...'}
            </ThemedText>
          </View>
        ) : (
          <>
            {!isConnected && (
              <View style={stylesLocal.offlineBanner}>
                <MaterialIcons name="cloud-off" size={resp.fontSize(16)} color="#ff9800" />
                <ThemedText style={stylesLocal.offlineText}>
                  Offline mode - Showing {totalInvoices} unsynced invoice{totalInvoices !== 1 ? 's' : ''}
                </ThemedText>
              </View>
            )}
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => <InvoiceRow item={item} />}
              contentContainerStyle={{ paddingBottom: resp.vertical(30) }}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEndReached={onLoadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ThemedText>
                    {searchText.trim()
                      ? 'No invoices match your search.'
                      : isConnected
                        ? 'No invoices found'
                        : 'No unsynced invoices'}
                  </ThemedText>
                </View>
              }
              ListFooterComponent={
                // Only show loading or load more if not filtering/searching and there are filtered results
                (() => {
                  const isFiltering = !!searchText.trim() || selectedCustomer || selectedStatus || selectedShop || selectedDate;
                  if (isFiltering || filtered.length === 0) return null;
                  if (loadingMore) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={tint} />
                        <ThemedText style={{ marginTop: 5, fontSize: resp.fontSize(12) }}>
                          Loading more...
                        </ThemedText>
                      </View>
                    );
                  } else if (isConnected && currentPage < totalPages) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={[stylesLocal.loadMoreBtn, { backgroundColor: tint }]}
                          onPress={onLoadMore}
                        >
                          <ThemedText style={stylesLocal.loadMoreText}>
                            Load More (Page {currentPage + 1}/{totalPages})
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  } else if (isConnected && totalInvoices > 0) {
                    return (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <ThemedText style={{ fontSize: resp.fontSize(12), color: icon }}>
                          Showing all {totalInvoices} invoices
                        </ThemedText>
                      </View>
                    );
                  }
                  return null;
                })()
              }
            />
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: {
      flex: 1, paddingVertical: resp.horizontalScale(16),
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
    iconCircle: { width: resp.horizontalScale(20), height: resp.horizontalScale(20), borderRadius: resp.horizontalScale(10), marginLeft: resp.horizontalScale(8) },
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
    headerBadges: { flexDirection: 'row', marginTop: resp.vertical(6) },
    countBadge: { paddingVertical: resp.vertical(4), paddingHorizontal: resp.horizontalScale(8), borderRadius: resp.horizontalScale(8) },
    countText: { color: '#fff', fontWeight: '700', fontSize: resp.fontSize(12) },
    addButton: { paddingVertical: resp.vertical(6), paddingHorizontal: resp.horizontalScale(10), borderRadius: resp.horizontalScale(8) },
    addButtonText: { color: '#fff', fontSize: resp.fontSize(13) },
    offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg === Colors.light.background ? '#fff3e0' : '#3d2d1f',
      padding: resp.horizontalScale(12),
      borderRadius: resp.horizontalScale(8),
      marginBottom: resp.vertical(12),
      gap: resp.horizontalScale(8),
    },
    offlineText: {
      color: '#ff9800',
      fontSize: resp.fontSize(13),
      fontWeight: '600',
    },
    loadMoreBtn: {
      paddingVertical: resp.vertical(10),
      paddingHorizontal: resp.horizontalScale(20),
      borderRadius: resp.horizontalScale(8),
    },
    loadMoreText: {
      color: '#fff',
      fontSize: resp.fontSize(13),
      fontWeight: '600',
    },
  });
