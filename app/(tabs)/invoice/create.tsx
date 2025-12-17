import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { bankAccountService } from '@/services/bankAccountService';
import { invoiceService } from '@/services/invoiceService';
import type { BankAccountRow } from '@/services/localDatabase';
import { categoryService, productService } from '@/services/productService';
import { warehouseService } from '@/services/warehouseService';
import type { Category, Product } from '@/types/product';
import type { Warehouse } from '@/types/warehouse';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

type ProductItem = {
  id: string;
  product: string;
  shop: string;
  quantity: string;
  rate: string;
  discount: string;
  tax: string;
  description: string;
  price: string;
};

type PaymentDetail = {
  id: string;
  amount: string;
  account: string;
  date: string;
  reference: string;
};

export default function CreateInvoice() {
  const resp = useResponsive();
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');
  const router = useRouter();
  const { customers, dealers } = useSync();

  // Refs for scrolling
  const mainScrollViewRef = useRef<ScrollView>(null);

  // Bottom sheet refs
  const addProductBottomSheetRef = useRef<BottomSheet>(null);
  const addPaymentBottomSheetRef = useRef<BottomSheet>(null);

  // Bottom sheet snap points
  const productSnapPoints = useMemo(() => ['90%'], []);
  const paymentSnapPoints = useMemo(() => ['90%'], []);

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  // Form state
  const [customerType, setCustomerType] = useState<'customer' | 'walk-in' | 'dealers'>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInContactNumber, setWalkInContactNumber] = useState('');
  const [walkInAddress, setWalkInAddress] = useState('');
  const [issueDate, setIssueDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [deliveryStatus, setDeliveryStatus] = useState('Pending');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [masterDiscount, setMasterDiscount] = useState('');
  const [isLoadingInvoiceNumber, setIsLoadingInvoiceNumber] = useState(false);
  const [invoiceNumberDisabled, setInvoiceNumberDisabled] = useState(true);

  // Products
  const [products, setProducts] = useState<ProductItem[]>([]);

  // Payment details
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalType, setDateModalType] = useState<'issue' | 'due'>('issue');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(-1);

  // Temporary product/payment for modal
  const [tempProduct, setTempProduct] = useState<ProductItem>({
    id: '',
    product: '',
    shop: '',
    quantity: '1',
    rate: '0',
    discount: '0',
    tax: '0',
    description: '',
    price: '0',
  });

  const [tempPayment, setTempPayment] = useState<PaymentDetail>({
    id: '',
    amount: '0',
    account: '',
    date: new Date().toLocaleDateString(),
    reference: '',
  });

  // Product search state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);

  // Warehouses state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [filteredBankAccounts, setFilteredBankAccounts] = useState<BankAccountRow[]>([]);

  // Calculate totals with memoization
  const calculateTotals = useCallback(() => {
    const subtotal = products.reduce((sum, product) => {
      const price = parseFloat(product.price.replace(/[^\d.]/g, '')) || 0;
      return sum + price;
    }, 0);

    const discountAmount = (subtotal * parseFloat(masterDiscount || '0')) / 100;
    const total = subtotal - discountAmount;
    const totalPaid = paymentDetails.reduce((sum, payment) => {
      return sum + (parseFloat(payment.amount) || 0);
    }, 0);
    const dueAmount = total - totalPaid;

    return {
      subtotal: subtotal.toFixed(2),
      discount: discountAmount.toFixed(2),
      total: total.toFixed(2),
      paid: totalPaid.toFixed(2),
      due: dueAmount.toFixed(2),
    };
  }, [products, masterDiscount, paymentDetails]);

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch next invoice number when warehouse is selected
  const fetchNextInvoiceNumber = async (warehouseId: number) => {
    try {
      setIsLoadingInvoiceNumber(true);
      const { getAxiosInstance } = await import('@/lib/axios');
      const axiosInstance = getAxiosInstance();
      const response = await axiosInstance.get(`/invoice/next-number/${warehouseId}`);

      if (response.data?.status && response.data?.data?.formatted_number) {
        setInvoiceNumber(response.data.data.formatted_number);
        setInvoiceNumberDisabled(false);
        console.log('[CreateInvoice] Invoice number fetched:', response.data.data.formatted_number);
      } else {
        console.warn('[CreateInvoice] Invalid response format:', response.data);
        Alert.alert('Warning', 'Could not fetch invoice number. Please enter manually.');
        setInvoiceNumberDisabled(false);
      }
    } catch (error) {
      console.error('[CreateInvoice] Error fetching invoice number:', error);
      Alert.alert('Error', 'Failed to fetch invoice number. Please enter manually.');
      setInvoiceNumberDisabled(false);
    } finally {
      setIsLoadingInvoiceNumber(false);
    }
  };

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await categoryService.getLocalCategories();
        console.log('[CreateInvoice] Loaded categories:', cats.slice(0, 5));
        setCategories(cats as any);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Load warehouses and bank accounts on mount
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const whs = await warehouseService.getLocalWarehouses();
        setWarehouses(whs);
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    };

    const loadBankAccounts = async () => {
      try {
        const accounts = await bankAccountService.getBankAccounts();
        setBankAccounts(accounts);
      } catch (error) {
        console.error('Error loading bank accounts:', error);
      }
    };

    loadWarehouses();
    loadBankAccounts();
  }, []);

  // Filter bank accounts when warehouse changes
  useEffect(() => {
    if (selectedWarehouse && bankAccounts.length > 0) {
      const filtered = bankAccounts.filter(
        account => account.warehouseId === selectedWarehouse.id
      );
      console.log('[CreateInvoice] Filtering bank accounts for warehouse:', selectedWarehouse.id, filtered);
      setFilteredBankAccounts(filtered);
      console.log(`[CreateInvoice] Filtered ${filtered.length} bank accounts for warehouse ${selectedWarehouse.id}`);
    } else {
      setFilteredBankAccounts([]);
    }
  }, [selectedWarehouse, bankAccounts]);

  // Search products with debouncing
  useEffect(() => {
    const searchProducts = async () => {
      if (!productSearchQuery.trim()) {
        setProductSuggestions([]);
        setShowProductSuggestions(false);
        return;
      }

      setIsSearchingProducts(true);
      try {
        const results = await productService.searchProducts(productSearchQuery);
        setProductSuggestions(results);
        setShowProductSuggestions(results.length > 0);
      } catch (error) {
        console.error('Error searching products:', error);
        setProductSuggestions([]);
      } finally {
        setIsSearchingProducts(false);
      }
    };

    // Debounce search
    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [productSearchQuery]);

  const selectProductFromSuggestions = useCallback((product: Product) => {
    console.log('[CreateInvoice] Product selected:', product);

    // Clear search query first
    setProductSearchQuery('');
    setShowProductSuggestions(false);

    // Auto-fill product details
    setTempProduct(prev => {
      const updated = {
        ...prev,
        id: product.id.toString(), // Store the product ID
        product: product.label,
        rate: product.sale_price || '0',
        description: product.description || '',
        quantity: '1', // Default quantity to 1
      };

      // Calculate price with the new rate
      const qty = parseFloat(updated.quantity) || 0;
      const rate = parseFloat(updated.rate) || 0;
      const discount = parseFloat(updated.discount) || 0;
      const subtotal = qty * rate;
      const discountAmount = (subtotal * discount) / 100;
      updated.price = (subtotal - discountAmount).toFixed(2);

      console.log('[CreateInvoice] Product auto-filled:', updated);
      return updated;
    });
  }, []);

  const addProduct = useCallback(() => {
    // Reset temp product and show bottom sheet
    setTempProduct({
      id: Date.now().toString(),
      product: '',
      shop: '',
      quantity: '1',
      rate: '0',
      discount: '0',
      tax: '0',
      description: '',
      price: '0',
    });
    setProductSearchQuery('');
    setShowProductSuggestions(false);
    addProductBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const confirmAddProduct = useCallback(() => {
    // Validate required fields
    if (!tempProduct.product.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }

    console.log('[CreateInvoice] Adding product:', tempProduct);

    // Add the product to the list
    setProducts(prev => [...prev, { ...tempProduct, id: tempProduct.id || Date.now().toString() }]);

    // Close bottom sheet and reset temp product
    addProductBottomSheetRef.current?.close();
    setTempProduct({
      id: '',
      product: '',
      shop: '',
      quantity: '1',
      rate: '0',
      discount: '0',
      tax: '0',
      description: '',
      price: '0',
    });
  }, [tempProduct]);

  const updateTempProduct = useCallback((field: keyof ProductItem, value: string) => {
    setTempProduct(prev => {
      const updated = { ...prev, [field]: value };

      // Recalculate price when quantity or rate changes
      if (field === 'quantity' || field === 'rate' || field === 'discount') {
        const qty = parseFloat(updated.quantity) || 0;
        const rate = parseFloat(updated.rate) || 0;
        const discount = parseFloat(updated.discount) || 0;
        const subtotal = qty * rate;
        const discountAmount = (subtotal * discount) / 100;
        updated.price = (subtotal - discountAmount).toFixed(2);
      }

      return updated;
    });
  }, []);

  const updateProduct = useCallback((id: string, field: keyof ProductItem, value: string) => {
    setProducts(prevProducts => prevProducts.map(product => {
      if (product.id === id) {
        const updated = { ...product, [field]: value };

        // Recalculate price when quantity or rate changes
        if (field === 'quantity' || field === 'rate' || field === 'discount') {
          const qty = parseFloat(updated.quantity) || 0;
          const rate = parseFloat(updated.rate) || 0;
          const discount = parseFloat(updated.discount) || 0;
          const subtotal = qty * rate;
          const discountAmount = (subtotal * discount) / 100;
          updated.price = (subtotal - discountAmount).toFixed(2);
        }

        return updated;
      }
      return product;
    }));
  }, []);

  const removeProduct = useCallback((id: string) => {
    setProducts(prevProducts => {
      if (prevProducts.length > 1) {
        return prevProducts.filter(product => product.id !== id);
      }
      return prevProducts;
    });
  }, []);

  const addPayment = useCallback(() => {
    // Reset temp payment and show bottom sheet
    setTempPayment({
      id: Date.now().toString(),
      amount: '0',
      account: '',
      date: new Date().toLocaleDateString(),
      reference: '',
    });
    addPaymentBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const confirmAddPayment = useCallback(() => {
    // Validate required fields
    if (!tempPayment.account.trim()) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    // Add the payment to the list
    setPaymentDetails(prev => [...prev, { ...tempPayment, id: Date.now().toString() }]);

    // Dismiss keyboard and close bottom sheet
    Keyboard.dismiss();
    setTimeout(() => {
      addPaymentBottomSheetRef.current?.close();
    }, 100);
    
    // Reset temp payment
    setTempPayment({
      id: '',
      amount: '0',
      account: '',
      date: new Date().toLocaleDateString(),
      reference: '',
    });
  }, [tempPayment]);

  const updateTempPayment = useCallback((field: keyof PaymentDetail, value: string) => {
    setTempPayment(prev => ({ ...prev, [field]: value }));
  }, []);

  const updatePayment = useCallback((id: string, field: keyof PaymentDetail, value: string) => {
    setPaymentDetails(prevPayments => prevPayments.map(payment =>
      payment.id === id ? { ...payment, [field]: value } : payment
    ));
  }, []);

  const removePayment = useCallback((id: string) => {
    setPaymentDetails(prevPayments => {
      if (prevPayments.length > 1) {
        return prevPayments.filter(payment => payment.id !== id);
      }
      return prevPayments;
    });
  }, []);

  const handleCreate = async () => {
    // Validate required fields
    if (customerType === 'customer' && !selectedCustomer) {
      Alert.alert('Error', 'Please select a customer');
      return;
    }

    if (customerType === 'walk-in') {
      if (!walkInCustomerName.trim()) {
        Alert.alert('Error', 'Please enter customer name');
        return;
      }
      if (!walkInContactNumber.trim()) {
        Alert.alert('Error', 'Please enter contact number');
        return;
      }
    }

    if (customerType === 'dealers' && !selectedCustomer) {
      Alert.alert('Error', 'Please select a dealer');
      return;
    }

    if (!selectedWarehouse) {
      Alert.alert('Error', 'Please select a shop/warehouse');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (products.length === 0 || products.some(p => !p.product.trim())) {
      Alert.alert('Error', 'Please add at least one product with valid details');
      return;
    }

    try {
      // Format dates to YYYY-MM-DD
      const formatDateForAPI = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Find customer name based on type
      let customerName = 'Unknown Customer';
      if (customerType === 'walk-in') {
        customerName = walkInCustomerName;
      } else if (customerType === 'dealers') {
        const dealer = dealers.find(d => d.id.toString() === selectedCustomer);
        customerName = dealer?.name || 'Unknown Dealer';
        console.log('[CreateInvoice] Dealer lookup:', { selectedCustomer, dealer, name: customerName });
      } else {
        const customer = customers.find(c => {
          const customerId = c.serverId || c.id;
          return customerId === selectedCustomer || customerId?.toString() === selectedCustomer;
        });
        customerName = customer?.name || 'Unknown Customer';
        console.log('[CreateInvoice] Customer lookup:', { 
          selectedCustomer, 
          customer, 
          name: customerName,
          allCustomers: customers.map(c => ({ id: c.id, serverId: c.serverId, name: c.name }))
        });
      }

      // Prepare invoice data
      const invoiceData = {
        invoice: {
          invoiceNo: invoiceNumber || `INV-${Date.now()}`,
          customerId: selectedCustomer && selectedCustomer !== 'null' ? selectedCustomer : '0',
          customerName: customerName,
          customerType: customerType === 'dealers' ? 'Dealer' : 'Customer',
          categoryId: selectedCategory && selectedCategory !== 'null' ? selectedCategory : '0',
          warehouseId: selectedWarehouse.id.toString(),
          warehouseName: selectedWarehouse.name,
          refNumber: referenceNumber,
          deliveryStatus: deliveryStatus,
          issueDate: formatDateForAPI(issueDate),
          dueDate: formatDateForAPI(dueDate),
          subTotal: totals.subtotal,
          discountTotal: totals.discount,
          taxTotal: '0',
          grandTotal: totals.total,
          dueAmount: totals.due,
          status: (parseFloat(totals.due) === 0 ? 'Paid' : 
                  parseFloat(totals.paid) > 0 ? 'Partially Paid' : 'Unpaid') as 'Paid' | 'Partially Paid' | 'Unpaid',
        },
        items: products.map(product => {
          // Use the stored product ID from when it was selected
          const productId = parseInt(product.id) || 0;
          return {
            id: productId,
            quantity: parseFloat(product.quantity) || 1,
            description: product.description || product.product,
            price: parseFloat(product.rate) || 0,
            shop_id: selectedWarehouse.id,
          };
        }),
        payments: paymentDetails.map(payment => {
          console.log('[CreateInvoice] Processing payment for API:', payment);
          // Extract bank account ID from "account-{id}" format
          const accountIdMatch = payment.account.match(/^account-(\d+)$/);
          const accountId = accountIdMatch ? parseInt(accountIdMatch[1], 10) : null;
          
          // Find account by ID to get the chart_account_id
          const account = filteredBankAccounts.find(acc => acc.id === accountId);
          console.log('[CreateInvoice] Mapping payment:', payment, 'Account ID:', accountId, 'Found account:', account);
          return {
            amount: parseFloat(payment.amount) || 0,
            account_id: account?.id || 0,
            payment_method: 1, // Default payment method
            date: payment.date,
            reference: payment.reference || '',
          };
        }),
      };

      console.log('[CreateInvoice] Creating invoice:', invoiceData);

      // Create invoice using the service (offline-first approach)
      const result = await invoiceService.createInvoice(invoiceData);

      if (result) {
        Alert.alert('Success', 'Invoice created successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create invoice. Please try again.');
      }
    } catch (error: any) {
      console.error('[CreateInvoice] Error creating invoice:', error);
      Alert.alert('Error', error.message || 'Failed to create invoice. Please try again.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Invoice',
      'Are you sure you want to cancel? All data will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Cancel Invoice', style: 'destructive', onPress: () => router.back() }
      ]
    );
  };

  // Memoized ProductItem component for better performance (Table Row)
  const ProductItemComponent = React.memo(({
    product,
    index,
    onUpdate,
    onRemove,
    canRemove
  }: {
    product: ProductItem;
    index: number;
    onUpdate: (id: string, field: keyof ProductItem, value: string) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
  }) => {
    return (
      <View style={stylesLocal.tableRow}>
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellIndex]}>{index + 1}</Text>
        {/* <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellProduct]}
          value={product.product}
          onChangeText={(value) => onUpdate(product.id, 'product', value)}
          placeholder="Product"
          placeholderTextColor={icon}
        /> */}
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellSmall]}
          value={product.quantity}
          onChangeText={(value) => onUpdate(product.id, 'quantity', value)}
          placeholder="Qty"
          placeholderTextColor={icon}
          keyboardType="numeric"
        />
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellMedium]}
          value={product.rate}
          onChangeText={(value) => onUpdate(product.id, 'rate', value)}
          placeholder="Price"
          placeholderTextColor={icon}
          keyboardType="numeric"
        />
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellSmall]}
          value={product.discount}
          onChangeText={(value) => onUpdate(product.id, 'discount', value)}
          placeholder="Disc%"
          placeholderTextColor={icon}
          keyboardType="numeric"
        />
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellPrice]}>{product.price}</Text>
        {canRemove && (
          <TouchableOpacity
            onPress={() => onRemove(product.id)}
            style={stylesLocal.tableDeleteBtn}
          >
            <MaterialIcons name="delete-outline" size={resp.fontSize(18)} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  });

  // List footer component (totals)
  const ListFooterComponent = useMemo(() => (
    <View style={stylesLocal.totalsCard}>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Sub Total:</Text>
        <Text style={stylesLocal.totalValue}>{totals.subtotal} Rs.</Text>
      </View>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Discount ({masterDiscount || '0'}%):</Text>
        <Text style={[stylesLocal.totalValue, { color: '#e74c3c' }]}>-{totals.discount} Rs.</Text>
      </View>
      <View style={[stylesLocal.totalRow, stylesLocal.totalRowFinal]}>
        <Text style={stylesLocal.totalLabelFinal}>Total Amount:</Text>
        <Text style={stylesLocal.totalValueFinal}>{totals.total} Rs.</Text>
      </View>
    </View>
  ), [totals, masterDiscount]);

  // Memoized PaymentItem component for better performance (Table Row)
  const PaymentItemComponent = React.memo(({
    payment,
    index,
    onUpdate,
    onRemove,
    canRemove,
    onAccountSelect
  }: {
    payment: PaymentDetail;
    index: number;
    onUpdate: (id: string, field: keyof PaymentDetail, value: string) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
    onAccountSelect: (index: number) => void;
  }) => {
    return (
      <View style={stylesLocal.paymentTableRow}>
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellIndex]}>{index + 1}</Text>
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellMedium]}
          value={payment.amount}
          onChangeText={(value) => onUpdate(payment.id, 'amount', value)}
          placeholder="Amount"
          placeholderTextColor={icon}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[stylesLocal.tableCell, stylesLocal.tableCellAccount]}
          onPress={() => onAccountSelect(index)}
        >
          <Text style={[stylesLocal.tableCellText, { color: payment.account ? text : icon }]} numberOfLines={1}>
            {payment.account || 'Select Account'}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellMedium]}
          value={payment.date}
          onChangeText={(value) => onUpdate(payment.id, 'date', value)}
          placeholder="Date"
          placeholderTextColor={icon}
        />
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellMedium]}
          value={payment.reference}
          onChangeText={(value) => onUpdate(payment.id, 'reference', value)}
          placeholder="Reference"
          placeholderTextColor={icon}
        />
        {canRemove && (
          <TouchableOpacity
            onPress={() => onRemove(payment.id)}
            style={stylesLocal.tableDeleteBtn}
          >
            <MaterialIcons name="delete-outline" size={resp.fontSize(18)} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  });

  // Payment list footer (payment summary)
  const PaymentListFooterComponent = useMemo(() => (
    <View style={stylesLocal.totalsCard}>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Total Amount:</Text>
        <Text style={stylesLocal.totalValue}>{totals.total} Rs.</Text>
      </View>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Paid:</Text>
        <Text style={[stylesLocal.totalValue, { color: '#27ae60' }]}>{totals.paid} Rs.</Text>
      </View>
      <View style={[stylesLocal.totalRow, stylesLocal.totalRowFinal]}>
        <Text style={stylesLocal.totalLabelFinal}>Due:</Text>
        <Text style={[stylesLocal.totalValueFinal, { color: '#e74c3c' }]}>{totals.due} Rs.</Text>
      </View>
    </View>
  ), [totals]);

  // Dropdown Modal Component
  function DropdownModal({
    visible,
    title,
    options,
    onClose,
    onSelect
  }: {
    visible: boolean;
    title: string;
    options: Array<{ id: string; label: string }>;
    onClose: () => void;
    onSelect: (value: string) => void;
  }) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={stylesLocal.modalOverlay} onPress={onClose} />
        <View style={stylesLocal.modalContent}>
          <Text style={stylesLocal.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: resp.vertical(300) }}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={stylesLocal.modalItem}
                onPress={() => {
                  onSelect(option.id);
                  onClose();
                }}
              >
                <Text style={stylesLocal.modalItemText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // Date Modal Component
  function DateModal({
    visible,
    onClose,
    onSelect
  }: {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
  }) {
    const today = new Date();
    const [monthOffset, setMonthOffset] = useState(0);
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const weeks: Array<Array<number | null>> = [];
    let current = 1 - firstWeekday;

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
            <TouchableOpacity onPress={() => setMonthOffset(m => m - 1)}>
              <Text style={stylesLocal.calendarNav}>◀</Text>
            </TouchableOpacity>
            <Text style={stylesLocal.calendarLabel}>{label}</Text>
            <TouchableOpacity onPress={() => setMonthOffset(m => m + 1)}>
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

  // Render backdrop for bottom sheets
  const renderProductBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const renderPaymentBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={stylesLocal.header}>
            <TouchableOpacity onPress={() => router.back()} style={stylesLocal.backBtn}>
              <MaterialIcons name="arrow-back" size={resp.fontSize(24)} color={icon} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={stylesLocal.headerTitle}>
              Create Invoice
            </ThemedText>
            <View style={stylesLocal.headerSpacer} />
          </View>

          <ScrollView
            ref={mainScrollViewRef}
            contentContainerStyle={{
              paddingBottom: resp.vertical(120),
              paddingTop: resp.vertical(8)
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* Customer Type Selection */}
            <View style={stylesLocal.section}>
              <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                Customer Type
              </ThemedText>
              <View style={stylesLocal.radioGroup}>
                <TouchableOpacity
                  style={stylesLocal.radioOption}
                  onPress={() => setCustomerType('customer')}
                >
                  <View style={[
                    stylesLocal.radio,
                    customerType === 'customer' && stylesLocal.radioSelected
                  ]}>
                    {customerType === 'customer' && (
                      <View style={{
                        width: resp.horizontalScale(8),
                        height: resp.horizontalScale(8),
                        borderRadius: resp.horizontalScale(4),
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: [
                          { translateX: -resp.horizontalScale(4) },
                          { translateY: -resp.horizontalScale(4) }
                        ]
                      }} />
                    )}
                  </View>
                  <Text style={stylesLocal.radioText}>Customer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={stylesLocal.radioOption}
                  onPress={() => setCustomerType('walk-in')}
                >
                  <View style={[
                    stylesLocal.radio,
                    customerType === 'walk-in' && stylesLocal.radioSelected
                  ]}>
                    {customerType === 'walk-in' && (
                      <View style={{
                        width: resp.horizontalScale(8),
                        height: resp.horizontalScale(8),
                        borderRadius: resp.horizontalScale(4),
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: [
                          { translateX: -resp.horizontalScale(4) },
                          { translateY: -resp.horizontalScale(4) }
                        ]
                      }} />
                    )}
                  </View>
                  <Text style={stylesLocal.radioText}>Walk In Customer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={stylesLocal.radioOption}
                  onPress={() => setCustomerType('dealers')}
                >
                  <View style={[
                    stylesLocal.radio,
                    customerType === 'dealers' && stylesLocal.radioSelected
                  ]}>
                    {customerType === 'dealers' && (
                      <View style={{
                        width: resp.horizontalScale(8),
                        height: resp.horizontalScale(8),
                        borderRadius: resp.horizontalScale(4),
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: [
                          { translateX: -resp.horizontalScale(4) },
                          { translateY: -resp.horizontalScale(4) }
                        ]
                      }} />
                    )}
                  </View>
                  <Text style={stylesLocal.radioText}>Dealers</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Customer Selection */}
            {customerType === 'customer' && (
              <View style={stylesLocal.section}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Customer
                </ThemedText>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => setShowCustomerModal(true)}
                >
                  <Text style={[stylesLocal.inputText, { color: selectedCustomer ? text : icon }]}>
                    {selectedCustomer ? customers.find(c => (c.serverId || c.id) === selectedCustomer)?.name || 'Select Customer' : 'Select Customer'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
            )}

            {/* Walk In Customer Details */}
            {customerType === 'walk-in' && (
              <View style={stylesLocal.section}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Walk In Customer Details
                </ThemedText>

                <View style={stylesLocal.formRow}>
                  <ThemedText style={stylesLocal.formLabel}>Customer Name</ThemedText>
                  <TextInput
                    style={stylesLocal.textInput}
                    value={walkInCustomerName}
                    onChangeText={setWalkInCustomerName}
                    placeholder="Enter customer name"
                    placeholderTextColor={icon}
                  />
                </View>

                <View style={stylesLocal.formRow}>
                  <ThemedText style={stylesLocal.formLabel}>Contact Number</ThemedText>
                  <TextInput
                    style={stylesLocal.textInput}
                    value={walkInContactNumber}
                    onChangeText={setWalkInContactNumber}
                    placeholder="Enter contact number"
                    placeholderTextColor={icon}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={stylesLocal.formRow}>
                  <ThemedText style={stylesLocal.formLabel}>Address</ThemedText>
                  <TextInput
                    style={[stylesLocal.textInput, {
                      height: resp.vertical(72),
                      paddingTop: resp.vertical(16),
                      textAlignVertical: 'top'
                    }]}
                    value={walkInAddress}
                    onChangeText={setWalkInAddress}
                    placeholder="Enter address"
                    placeholderTextColor={icon}
                    multiline
                  />
                </View>
              </View>
            )}

            {/* Dealers Selection */}
            {customerType === 'dealers' && (
              <View style={stylesLocal.section}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Dealers
                </ThemedText>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => setShowCustomerModal(true)}
                >
                  <Text style={[stylesLocal.inputText, { color: selectedCustomer ? text : icon }]}>
                    {selectedCustomer ? dealers.find(d => d.id.toString() === selectedCustomer)?.name || 'Select Dealer' : 'Select Dealer'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
            )}

            {/* Warehouse/Shop Selection */}
            <View style={stylesLocal.section}>
              <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                Shop / Warehouse
              </ThemedText>
              <TouchableOpacity
                style={stylesLocal.input}
                onPress={() => setShowWarehouseModal(true)}
              >
                <Text style={[stylesLocal.inputText, { color: selectedWarehouse ? text : icon }]}>
                  {selectedWarehouse?.name || 'Select Shop'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
              </TouchableOpacity>
            </View>

            {/* Dates */}
            <View style={stylesLocal.section}>
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Issue Date
                  </ThemedText>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => {
                      setDateModalType('issue');
                      setShowDateModal(true);
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={resp.fontSize(16)} color={icon} />
                    <Text style={stylesLocal.inputText}>{formatDate(issueDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Due Date
                  </ThemedText>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => {
                      setDateModalType('due');
                      setShowDateModal(true);
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={resp.fontSize(16)} color={icon} />
                    <Text style={stylesLocal.inputText}>{formatDate(dueDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Delivery Status and Category */}
            <View style={stylesLocal.section}>
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Delivery Status
                  </ThemedText>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => setShowDeliveryModal(true)}
                  >
                    <Text style={stylesLocal.inputText}>{deliveryStatus}</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                  </TouchableOpacity>
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Category
                  </ThemedText>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => setShowCategoryModal(true)}
                  >
                    <Text style={[stylesLocal.inputText, { color: selectedCategory ? text : icon }]}>
                      {selectedCategory ? categories.find(c => c.id.toString() === selectedCategory)?.name || 'Select Category' : 'Select Category'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Invoice Number and Reference */}
            <View style={stylesLocal.section}>
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Invoice Number {isLoadingInvoiceNumber && '(Loading...)'}
                  </ThemedText>
                  <TextInput
                    style={[
                      stylesLocal.textInput,
                      (invoiceNumberDisabled || isLoadingInvoiceNumber) && { backgroundColor: '#f0f0f0', opacity: 0.6 }
                    ]}
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                    placeholder="Select warehouse first"
                    placeholderTextColor={icon}
                    editable={!invoiceNumberDisabled && !isLoadingInvoiceNumber}
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                    Ref Number
                  </ThemedText>
                  <TextInput
                    style={stylesLocal.textInput}
                    value={referenceNumber}
                    onChangeText={setReferenceNumber}
                    placeholder="Enter Ref Number"
                    placeholderTextColor={icon}
                  />
                </View>
              </View>
            </View>

            {/* Products & Services - Table Format */}
            <View style={stylesLocal.section}>
              {/* Fixed Header */}
              <View style={stylesLocal.sectionHeader}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Products & Services
                </ThemedText>
                <TouchableOpacity
                  style={stylesLocal.addButton}
                  onPress={addProduct}
                >
                  <MaterialIcons name="add" size={resp.fontSize(16)} color="#fff" />
                  <Text style={stylesLocal.addButtonText}>Add Item</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable Products Table */}
              <View style={stylesLocal.productsContainer}>
                {products.length === 0 ? (
                  <View style={stylesLocal.emptyState}>
                    <MaterialIcons name="inventory-2" size={resp.fontSize(48)} color={icon} />
                    <ThemedText style={stylesLocal.emptyStateText}>
                      No products added yet
                    </ThemedText>
                    <ThemedText style={stylesLocal.emptyStateSubtext}>
                      Click "Add Item" to add products or services
                    </ThemedText>
                  </View>
                ) : (
                  <View>
                    {/* Table Header */}
                    <View style={stylesLocal.tableHeader}>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellIndex]}>#</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellSmall]}>Qty</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellMedium]}>Rate</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellPrice]}>Amount</Text>
                      <View style={{ width: resp.horizontalScale(32) }} />
                    </View>

                    {/* Table Rows */}
                    {products.map((item, index) => (
                      <ProductItemComponent
                        key={item.id}
                        product={item}
                        index={index}
                        onUpdate={updateProduct}
                        onRemove={removeProduct}
                        canRemove={products.length > 1}
                      />
                    ))}
                    {ListFooterComponent}
                  </View>
                )}
              </View>
            </View>

            {/* Add Payment - Table Format */}
            <View style={stylesLocal.section}>
              {/* Fixed Header */}
              <View style={stylesLocal.sectionHeader}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Add Payment
                </ThemedText>
                <TouchableOpacity
                  style={stylesLocal.addButton}
                  onPress={addPayment}
                >
                  <MaterialIcons name="add" size={resp.fontSize(16)} color="#fff" />
                  <Text style={stylesLocal.addButtonText}>Add Payment</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable Payments Table */}
              <View style={stylesLocal.productsContainer}>
                {paymentDetails.length === 0 ? (
                  <View style={stylesLocal.emptyState}>
                    <MaterialIcons name="payment" size={resp.fontSize(48)} color={icon} />
                    <ThemedText style={stylesLocal.emptyStateText}>
                      No payments added yet
                    </ThemedText>
                    <ThemedText style={stylesLocal.emptyStateSubtext}>
                      Click "Add Payment" to add payment details
                    </ThemedText>
                  </View>
                ) : (
                  <View>
                    {/* Payment Table Header */}
                    <View style={stylesLocal.tableHeader}>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellIndex]}>#</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellMedium]}>Amount</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellAccount]}>Account</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellMedium]}>Date</Text>
                      <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellMedium]}>Reference</Text>
                      <View style={{ width: resp.horizontalScale(32) }} />
                    </View>

                    {/* Payment Table Rows */}
                    {paymentDetails.map((item, index) => (
                      <PaymentItemComponent
                        key={item.id}
                        payment={item}
                        index={index}
                        onUpdate={updatePayment}
                        onRemove={removePayment}
                        canRemove={paymentDetails.length > 1}
                        onAccountSelect={(paymentIndex) => {
                          if (!selectedWarehouse) {
                            Alert.alert('Warehouse Required', 'Please select a warehouse first to see available bank accounts.');
                            return;
                          }
                          if (filteredBankAccounts.length === 0) {
                            Alert.alert('No Bank Accounts', 'No bank accounts are available for the selected warehouse.');
                            return;
                          }
                          setSelectedPaymentIndex(paymentIndex);
                          setShowAccountModal(true);
                        }}
                      />
                    ))}
                    {PaymentListFooterComponent}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View style={stylesLocal.bottomActions}>
            <TouchableOpacity
              style={stylesLocal.cancelButton}
              onPress={handleCancel}
            >
              <Text style={stylesLocal.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={stylesLocal.createButton}
              onPress={handleCreate}
            >
              <Text style={stylesLocal.createButtonText}>Create</Text>
            </TouchableOpacity>
          </View>

          {/* Modals */}
          <DropdownModal
            visible={showCustomerModal}
            title={customerType === 'dealers' ? 'Select Dealer' : 'Select Customer'}
            options={
              customerType === 'dealers'
                ? dealers.map(d => ({ id: d.id.toString(), label: d.name }))
                : customers.map(c => ({ id: c.serverId || c.id, label: c.name || '' }))
            }
            onClose={() => setShowCustomerModal(false)}
            onSelect={(value: string) => {
              console.log('Selected customer/dealer ID:', value);
              if (customerType === 'dealers') {
                setSelectedCustomer(value);
              } else {
                setSelectedCustomer(value);
              }
            }}
          />

          <DropdownModal
            visible={showWarehouseModal}
            title="Select Shop / Warehouse"
            options={warehouses.map(w => ({ id: w.id.toString(), label: w.name }))}
            onClose={() => setShowWarehouseModal(false)}
            onSelect={(warehouseId) => {
              const warehouse = warehouses.find(w => w.id.toString() === warehouseId);
              if (warehouse) {
                setSelectedWarehouse(warehouse);
                // Fetch next invoice number when warehouse is selected
                fetchNextInvoiceNumber(warehouse.id);
              }
            }}
          />

          <DropdownModal
            visible={showCategoryModal}
            title="Select Category"
            options={categories.map(c => ({ id: c.id.toString(), label: c.name || '' }))}
            onClose={() => setShowCategoryModal(false)}
            onSelect={setSelectedCategory}
          />

          <DropdownModal
            visible={showDeliveryModal}
            title="Select Delivery Status"
            options={[
              { id: 'pending', label: 'Pending' },
              { id: 'processing', label: 'Processing' },
              { id: 'shipped', label: 'Shipped / Dispatched' },
              { id: 'out-for-delivery', label: 'Out for Delivery' },
              { id: 'delivered', label: 'Delivered' },
              { id: 'cancelled', label: 'Cancelled' },
              { id: 'returned', label: 'Returned' },
              { id: 'on-hold', label: 'On Hold' },
              { id: 'failed-delivery', label: 'Failed Delivery' },
              { id: 'refunded', label: 'Refunded' },
              { id: 'partially-delivered', label: 'Partially Delivered' }
            ]}
            onClose={() => setShowDeliveryModal(false)}
            onSelect={setDeliveryStatus}
          />

          <DropdownModal
            visible={showAccountModal}
            title="Select Account"
            options={filteredBankAccounts.length > 0
              ? filteredBankAccounts.map((acc) => ({
                id: `account-${acc.id}`,
                label: `${acc.bankName} - ${acc.holderName} (${acc.accountNumber})`
              }))
              : [{ id: 'no-accounts', label: 'No bank accounts available for this warehouse' }]
            }
            onClose={() => setShowAccountModal(false)}
            onSelect={(account) => {
              // Don't allow selection if no accounts
              if (account === 'No bank accounts available for this warehouse') {
                return;
              }

              // Check if we're in add payment mode (selectedPaymentIndex is -1 or invalid)
              if (selectedPaymentIndex < 0 || selectedPaymentIndex >= paymentDetails.length) {
                // Update temp payment for new payment being added
                updateTempPayment('account', account);
              } else {
                // Update existing payment in list
                const updatedPayments = [...paymentDetails];
                updatedPayments[selectedPaymentIndex].account = account;
                setPaymentDetails(updatedPayments);
              }
              setShowAccountModal(false);
            }}
          />

          <DateModal
            visible={showDateModal}
            onClose={() => setShowDateModal(false)}
            onSelect={(date) => {
              if (dateModalType === 'issue') {
                setIssueDate(date);
              } else {
                setDueDate(date);
              }
            }}
          />
        </ThemedView>

        {/* Add Product Bottom Sheet */}
        <BottomSheet
          ref={addProductBottomSheetRef}
          index={-1}
          snapPoints={productSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderProductBackdrop}
          backgroundStyle={{ backgroundColor: bg }}
          handleIndicatorStyle={{ backgroundColor: icon }}
        >
          <View style={stylesLocal.bottomSheetHeader}>
            <TouchableOpacity onPress={() => addProductBottomSheetRef.current?.close()} style={stylesLocal.modalCloseBtn}>
              <MaterialIcons name="close" size={resp.fontSize(24)} color={icon} />
            </TouchableOpacity>
            <Text style={stylesLocal.bottomSheetTitle}>Add Product/Service</Text>
            <View style={{ width: resp.horizontalScale(40) }} />
          </View>

          <BottomSheetScrollView contentContainerStyle={stylesLocal.bottomSheetContent}>
            <View style={stylesLocal.modalForm}>
              {/* Product Name with Search */}
              <View style={stylesLocal.formRow}>
                <ThemedText style={stylesLocal.formLabel}>Product Name *</ThemedText>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={productSearchQuery || tempProduct.product}
                    onChangeText={(value) => {
                      setProductSearchQuery(value);
                      updateTempProduct('product', value);
                    }}
                    placeholder="Search or enter product name"
                    placeholderTextColor={icon}
                    onFocus={() => {
                      if (productSuggestions.length > 0) {
                        setShowProductSuggestions(true);
                      }
                    }}
                  />
                  {isSearchingProducts && (
                    <View style={stylesLocal.searchLoader}>
                      <Text style={{ color: icon, fontSize: resp.fontSize(12) }}>Searching...</Text>
                    </View>
                  )}
                  {showProductSuggestions && productSuggestions.length > 0 && (
                    <View style={stylesLocal.suggestionsContainer}>
                      <ScrollView
                        style={stylesLocal.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                      >
                        {productSuggestions.map((item) => (
                          <TouchableOpacity
                            key={item.id.toString()}
                            style={stylesLocal.suggestionItem}
                            onPress={() => selectProductFromSuggestions(item)}
                          >
                            <Text style={[stylesLocal.suggestionText, { color: text }]}>
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Quantity and Price */}
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Quantity</ThemedText>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempProduct.quantity}
                    onChangeText={(value) => updateTempProduct('quantity', value)}
                    placeholder="1"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Rate</ThemedText>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempProduct.rate}
                    onChangeText={(value) => updateTempProduct('rate', value)}
                    placeholder="0.00"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Description */}
              <View style={stylesLocal.formRow}>
                <ThemedText style={stylesLocal.formLabel}>Description</ThemedText>
                <TextInput
                  style={[stylesLocal.formInput, {
                    height: resp.vertical(100),
                    paddingTop: resp.vertical(16),
                    textAlignVertical: 'top'
                  }]}
                  value={tempProduct.description}
                  onChangeText={(value) => updateTempProduct('description', value)}
                  placeholder="Enter description"
                  placeholderTextColor={icon}
                  multiline
                />
              </View>

              {/* Price Display */}
              <View style={stylesLocal.priceRow}>
                <ThemedText style={stylesLocal.priceLabel}>Amount:</ThemedText>
                <ThemedText style={stylesLocal.priceValue}>{tempProduct.price} Rs.</ThemedText>
              </View>
            </View>
          </BottomSheetScrollView>

          <View style={stylesLocal.bottomSheetFooter}>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalCancelButton]}
              onPress={() => addProductBottomSheetRef.current?.close()}
            >
              <Text style={stylesLocal.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalAddButton]}
              onPress={confirmAddProduct}
            >
              <Text style={stylesLocal.modalAddButtonText}>Add Product</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        {/* Add Payment Bottom Sheet */}
        <BottomSheet
          ref={addPaymentBottomSheetRef}
          index={-1}
          snapPoints={paymentSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderPaymentBackdrop}
          backgroundStyle={{ backgroundColor: bg }}
          handleIndicatorStyle={{ backgroundColor: icon }}
          onChange={(index) => {
            if (index === -1) {
              Keyboard.dismiss();
            }
          }}
        >
          <View style={stylesLocal.bottomSheetHeader}>
            <TouchableOpacity onPress={() => {
              Keyboard.dismiss();
              addPaymentBottomSheetRef.current?.close();
            }} style={stylesLocal.modalCloseBtn}>
              <MaterialIcons name="close" size={resp.fontSize(24)} color={icon} />
            </TouchableOpacity>
            <Text style={stylesLocal.bottomSheetTitle}>Add Payment</Text>
            <View style={{ width: resp.horizontalScale(40) }} />
          </View>

          <BottomSheetScrollView 
            contentContainerStyle={stylesLocal.bottomSheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={stylesLocal.modalForm}>
              {/* Amount and Account */}
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Amount *</ThemedText>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempPayment.amount}
                    onChangeText={(value) => updateTempPayment('amount', value)}
                    placeholder="0"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Account *</ThemedText>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => {
                      if (!selectedWarehouse) {
                        Alert.alert('Warehouse Required', 'Please select a warehouse first to see available bank accounts.');
                        return;
                      }
                      if (filteredBankAccounts.length === 0) {
                        Alert.alert('No Bank Accounts', 'No bank accounts are available for the selected warehouse.');
                        return;
                      }
                      setShowAccountModal(true);
                    }}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[stylesLocal.inputText, { color: tempPayment.account ? text : icon }]}>
                      {tempPayment.account || 'Select Account'}
                    </Text>
                    <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date and Reference */}
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Date</ThemedText>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempPayment.date}
                    onChangeText={(value) => updateTempPayment('date', value)}
                    placeholder="11/05/2025"
                    placeholderTextColor={icon}
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <ThemedText style={stylesLocal.formLabel}>Reference</ThemedText>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempPayment.reference}
                    onChangeText={(value) => updateTempPayment('reference', value)}
                    placeholder="Enter Reference"
                    placeholderTextColor={icon}
                  />
                </View>
              </View>
            </View>
          </BottomSheetScrollView>

          <View style={stylesLocal.bottomSheetFooter}>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalCancelButton]}
              onPress={() => {
                Keyboard.dismiss();
                addPaymentBottomSheetRef.current?.close();
              }}
            >
              <Text style={stylesLocal.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalAddButton]}
              onPress={confirmAddPayment}
            >
              <Text style={stylesLocal.modalAddButtonText}>Add Payment</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const createStyles = (resp: ReturnType<typeof useResponsive>, theme: { bg: string; text: string; tint: string; icon: string }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg === Colors.light.background ? '#f8fafc' : '#0f172a',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(16),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderBottomWidth: 0,
    },
    backBtn: {
      width: resp.horizontalScale(40),
      height: resp.horizontalScale(40),
      borderRadius: resp.horizontalScale(20),
      backgroundColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: resp.fontSize(18),
      fontWeight: '500',
      color: theme.text,
      letterSpacing: -0.3,
    },
    headerSpacer: {
      width: resp.horizontalScale(40),
    },
    section: {
      marginBottom: resp.vertical(24),
      paddingHorizontal: resp.horizontalScale(20),
    },
    sectionTitle: {
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      color: theme.text,
      marginBottom: resp.vertical(16),
      letterSpacing: -0.2,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: resp.vertical(20),
    },
    productsContainer: {
      flex: 1,
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      // borderRadius: resp.horizontalScale(16),
      padding: resp.horizontalScale(4),
      // borderWidth: 1,
      // borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: resp.horizontalScale(16),
    },
    halfWidth: {
      flex: 1,
    },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: resp.vertical(52),
      paddingHorizontal: resp.horizontalScale(16),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      borderRadius: resp.horizontalScale(12),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    inputText: {
      fontSize: resp.fontSize(15),
      color: theme.text,
      flex: 1,
      fontWeight: '400',
    },
    textInput: {
      height: resp.vertical(52),
      paddingHorizontal: resp.horizontalScale(16),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      borderRadius: resp.horizontalScale(12),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      fontSize: resp.fontSize(15),
      color: theme.text,
      fontWeight: '400',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    radioGroup: {
      flexDirection: 'row',
      gap: resp.horizontalScale(20),
      flexWrap: 'wrap',
      marginTop: resp.vertical(8),
    },
    radioOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: resp.horizontalScale(12),
      paddingVertical: resp.vertical(8),
    },
    radio: {
      width: resp.horizontalScale(24),
      height: resp.horizontalScale(24),
      borderRadius: resp.horizontalScale(12),
      borderWidth: 2,
      borderColor: theme.bg === Colors.light.background ? '#cbd5e1' : '#64748b',
      position: 'relative',
    },
    radioSelected: {
      borderColor: theme.tint,
      backgroundColor: theme.tint,
    },
    radioText: {
      fontSize: resp.fontSize(15),
      color: theme.text,
      fontWeight: '400',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.tint,
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(12),
      borderRadius: resp.horizontalScale(10),
      gap: resp.horizontalScale(6),
      shadowColor: theme.tint,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    addButtonText: {
      color: '#ffffff',
      fontSize: resp.fontSize(13),
      fontWeight: '500',
      letterSpacing: 0.2,
    },
    productCard: {
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderRadius: resp.horizontalScale(16),
      padding: resp.horizontalScale(20),
      marginBottom: resp.vertical(16),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    paymentCard: {
      backgroundColor: theme.bg === Colors.light.background ? '#f0f9ff' : '#0f172a',
      borderRadius: resp.horizontalScale(16),
      padding: resp.horizontalScale(20),
      marginBottom: resp.vertical(16),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#bae6fd' : '#1e40af',
      shadowColor: theme.bg === Colors.light.background ? '#0ea5e9' : '#1e40af',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },
    productHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: resp.vertical(20),
      paddingBottom: resp.vertical(12),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
    },
    productNumber: {
      fontSize: resp.fontSize(15),
      fontWeight: '600',
      color: theme.tint,
      letterSpacing: 0.3,
    },
    removeButton: {
      width: resp.horizontalScale(32),
      height: resp.horizontalScale(32),
      borderRadius: resp.horizontalScale(16),
      backgroundColor: '#fee2e2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    productForm: {
      gap: resp.vertical(16),
    },
    formRow: {
      gap: resp.vertical(8),
    },
    formLabel: {
      fontSize: resp.fontSize(14),
      color: theme.text,
      fontWeight: '500',
      marginBottom: resp.vertical(4),
      letterSpacing: -0.1,
    },
    formInput: {
      height: resp.vertical(48),
      paddingHorizontal: resp.horizontalScale(16),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      borderRadius: resp.horizontalScale(10),
      backgroundColor: theme.bg === Colors.light.background ? '#f8fafc' : '#0f172a',
      fontSize: resp.fontSize(15),
      color: theme.text,
      fontWeight: '400',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 3,
      elevation: 1,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: resp.vertical(16),
      paddingTop: resp.vertical(16),
      borderTopWidth: 1,
      borderTopColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      backgroundColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#1e293b',
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(12),
      borderRadius: resp.horizontalScale(8),
    },
    priceLabel: {
      fontSize: resp.fontSize(15),
      color: theme.text,
      fontWeight: '500',
    },
    priceValue: {
      fontSize: resp.fontSize(17),
      color: '#059669',
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    totalsCard: {
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderRadius: resp.horizontalScale(16),
      padding: resp.horizontalScale(24),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      marginTop: resp.vertical(20),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 5,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: resp.vertical(12),
    },
    totalRowFinal: {
      borderTopWidth: 2,
      borderTopColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      paddingTop: resp.vertical(16),
      marginTop: resp.vertical(12),
      backgroundColor: theme.bg === Colors.light.background ? '#f8fafc' : '#0f172a',
      marginHorizontal: -resp.horizontalScale(24),
      paddingHorizontal: resp.horizontalScale(24),
      paddingBottom: resp.vertical(4),
      borderBottomLeftRadius: resp.horizontalScale(16),
      borderBottomRightRadius: resp.horizontalScale(16),
    },
    totalLabel: {
      fontSize: resp.fontSize(15),
      color: theme.icon,
      fontWeight: '400',
    },
    totalValue: {
      fontSize: resp.fontSize(15),
      color: theme.text,
      fontWeight: '500',
    },
    totalLabelFinal: {
      fontSize: resp.fontSize(17),
      color: theme.text,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    totalValueFinal: {
      fontSize: resp.fontSize(18),
      color: theme.text,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    bottomActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(20),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderTopWidth: 1,
      borderTopColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      gap: resp.horizontalScale(16),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 6,
    },
    cancelButton: {
      flex: 1,
      height: resp.vertical(52),
      borderWidth: 1.5,
      borderColor: '#ef4444',
      borderRadius: resp.horizontalScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    cancelButtonText: {
      color: '#ef4444',
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    createButton: {
      flex: 1,
      height: resp.vertical(52),
      backgroundColor: '#059669',
      borderRadius: resp.horizontalScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    createButtonText: {
      color: '#ffffff',
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      position: 'absolute',
      left: '8%',
      right: '8%',
      top: '20%',
      maxHeight: '60%',
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderRadius: resp.horizontalScale(20),
      padding: resp.horizontalScale(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 25,
      elevation: 15,
    },
    modalTitle: {
      fontSize: resp.fontSize(18),
      fontWeight: '600',
      color: theme.text,
      marginBottom: resp.vertical(20),
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    modalItem: {
      paddingVertical: resp.vertical(16),
      paddingHorizontal: resp.horizontalScale(16),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      borderRadius: resp.horizontalScale(8),
      marginBottom: resp.vertical(4),
    },
    modalItemText: {
      fontSize: resp.fontSize(16),
      color: theme.text,
      fontWeight: '400',
    },
    // Calendar styles
    calendarContainer: {
      position: 'absolute',
      left: '8%',
      right: '8%',
      top: '20%',
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderRadius: resp.horizontalScale(20),
      padding: resp.horizontalScale(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.3,
      shadowRadius: 30,
      elevation: 20,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: resp.vertical(24),
      paddingBottom: resp.vertical(16),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
    },
    calendarNav: {
      fontSize: resp.fontSize(24),
      color: theme.tint,
      fontWeight: '700',
      padding: resp.horizontalScale(12),
    },
    calendarLabel: {
      fontSize: resp.fontSize(16),
      color: theme.text,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    weekdaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: resp.vertical(16),
      paddingHorizontal: resp.horizontalScale(4),
    },
    weekday: {
      width: resp.horizontalScale(40),
      textAlign: 'center',
      color: theme.icon,
      fontSize: resp.fontSize(13),
      fontWeight: '500',
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: resp.vertical(8),
      paddingHorizontal: resp.horizontalScale(4),
    },
    dayBtn: {
      width: resp.horizontalScale(40),
      height: resp.horizontalScale(40),
      borderRadius: resp.horizontalScale(10),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg === Colors.light.background ? '#f8fafc' : '#334155',
    },
    dayBtnEmpty: {
      width: resp.horizontalScale(40),
      height: resp.horizontalScale(40),
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayText: {
      color: theme.text,
      fontSize: resp.fontSize(15),
      fontWeight: '500',
    },
    // Full modal styles for add product/payment
    fullModalContent: {
      height: '90%',
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderTopLeftRadius: resp.horizontalScale(24),
      borderTopRightRadius: resp.horizontalScale(24),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 25,
      elevation: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(20),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
    },
    modalCloseBtn: {
      width: resp.horizontalScale(40),
      height: resp.horizontalScale(40),
      borderRadius: resp.horizontalScale(20),
      backgroundColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalHeaderTitle: {
      fontSize: resp.fontSize(18),
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
    },
    modalScrollContent: {
      flex: 1,
      paddingHorizontal: resp.horizontalScale(20),
      paddingTop: resp.vertical(20),
    },
    modalForm: {
      gap: resp.vertical(16),
      paddingBottom: resp.vertical(20),
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(20),
      borderTopWidth: 1,
      borderTopColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      gap: resp.horizontalScale(16),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
    },
    modalButton: {
      flex: 1,
      height: resp.vertical(52),
      borderRadius: resp.horizontalScale(12),
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCancelButton: {
      borderWidth: 1.5,
      borderColor: '#94a3b8',
      backgroundColor: 'transparent',
    },
    modalCancelButtonText: {
      color: '#64748b',
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    modalAddButton: {
      backgroundColor: theme.tint,
      shadowColor: theme.tint,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    modalAddButtonText: {
      color: '#ffffff',
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: resp.vertical(60),
      paddingHorizontal: resp.horizontalScale(40),
    },
    emptyStateText: {
      fontSize: resp.fontSize(16),
      fontWeight: '600',
      color: theme.text,
      marginTop: resp.vertical(16),
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: resp.fontSize(14),
      color: theme.icon,
      marginTop: resp.vertical(8),
      textAlign: 'center',
    },
    // Table styles
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.vertical(12),
      backgroundColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      borderTopLeftRadius: resp.horizontalScale(12),
      borderTopRightRadius: resp.horizontalScale(12),
      borderBottomWidth: 2,
      borderBottomColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
    },
    tableHeaderCell: {
      fontSize: resp.fontSize(13),
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.vertical(10),
      borderBottomWidth: 1,
      gap: resp.horizontalScale(3),
      borderBottomColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
    },
    tableCell: {
      fontSize: resp.fontSize(13),
      color: theme.text,
      paddingHorizontal: resp.horizontalScale(6),
      paddingVertical: resp.vertical(8),
      textAlign: 'center',
      borderRadius: resp.horizontalScale(6),
      backgroundColor: theme.bg === Colors.light.background ? '#f8fafc' : '#0f172a',
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
    },
    tableCellIndex: {
      width: resp.horizontalScale(35),
      fontWeight: '600',
    },
    tableCellProduct: {
      flex: 1,
      textAlign: 'left',
      marginLeft: resp.horizontalScale(4),
      marginRight: resp.horizontalScale(4),
    },
    tableCellSmall: {
      width: resp.horizontalScale(55),
    },
    tableCellMedium: {
      width: resp.horizontalScale(70),
    },
    tableCellPrice: {
      width: resp.horizontalScale(75),
      fontWeight: '600',
      color: '#059669',
    },
    tableDeleteBtn: {
      width: resp.horizontalScale(32),
      height: resp.horizontalScale(32),
      borderRadius: resp.horizontalScale(16),
      backgroundColor: '#fee2e2',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: resp.horizontalScale(4),
    },
    paymentTableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: resp.horizontalScale(12),
      paddingVertical: resp.vertical(10),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#bae6fd' : '#1e40af',
      backgroundColor: theme.bg === Colors.light.background ? '#f0f9ff' : '#0f172a',
    },
    tableCellAccount: {
      flex: 1,
      textAlign: 'left',
      marginLeft: resp.horizontalScale(4),
      marginRight: resp.horizontalScale(4),
      justifyContent: 'center',
    },
    tableCellText: {
      fontSize: resp.fontSize(13),
      color: theme.text,
    },
    // Bottom sheet styles
    bottomSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(16),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
    },
    bottomSheetTitle: {
      fontSize: resp.fontSize(18),
      fontWeight: '600',
      color: theme.text,
      letterSpacing: -0.2,
    },
    bottomSheetContent: {
      paddingHorizontal: resp.horizontalScale(20),
      paddingBottom: resp.vertical(100),
    },
    bottomSheetFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: resp.horizontalScale(20),
      paddingVertical: resp.vertical(20),
      borderTopWidth: 1,
      borderTopColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      gap: resp.horizontalScale(16),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
    },
    // Product search styles
    searchLoader: {
      position: 'absolute',
      right: resp.horizontalScale(12),
      top: '50%',
      transform: [{ translateY: -resp.fontSize(6) }],
    },
    suggestionsContainer: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderRadius: resp.horizontalScale(8),
      marginTop: resp.vertical(4),
      maxHeight: resp.vertical(200),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      zIndex: 1000,
    },
    suggestionsList: {
      maxHeight: resp.vertical(200),
    },
    suggestionItem: {
      paddingHorizontal: resp.horizontalScale(16),
      paddingVertical: resp.vertical(12),
      borderBottomWidth: 1,
      borderBottomColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
    },
    suggestionText: {
      fontSize: resp.fontSize(14),
      fontWeight: '400',
    },
  });