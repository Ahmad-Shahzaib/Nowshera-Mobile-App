import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { invoiceService } from '@/services/invoiceService';
import { categoryService, productService } from '@/services/productService';
import { warehouseService } from '@/services/warehouseService';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  purchase_price?: string; // Store purchase price for validation
};

type PaymentDetail = {
  id: string;
  amount: string;
  account: string;
  date: string;
  reference: string;
};

const SAMPLE_ACCOUNTS = [
  'Cash Account',
  'Bank Account - HBL',
  'Bank Account - UBL',
  'Petty Cash',
];

// Warehouse mapping
const WAREHOUSE_MAP: { [key: number]: string } = {
  1: 'Main Warehouse',
  2: 'Outlet A',
  3: 'Outlet B',
  4: 'MASHAALLAH FOAM ABDALI ROAD',
  5: 'Anas Foam House',
};

// Category mapping
const CATEGORY_MAP: { [key: number]: string } = {
  1: 'Foam Products',
  2: 'Timber & Wood',
  3: 'Electronics',
  4: 'Furniture',
  5: 'Construction Materials',
  6: 'Hardware',
  7: 'Paints & Coatings',
  8: 'Office Supplies',
  9: 'General Products',
};

// Sample invoice data for editing
// REMOVED: Using dynamic data from API instead

export default function EditInvoice() {
  const resp = useResponsive();
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Refs for scrolling
  const mainScrollViewRef = useRef<ScrollView>(null);
  const productsListRef = useRef<FlatList>(null);
  const paymentsListRef = useRef<FlatList>(null);

  // Refs for bottom sheets
  const addProductBottomSheetRef = useRef<BottomSheet>(null);
  const addPaymentBottomSheetRef = useRef<BottomSheet>(null);
  const walkInNameRef = useRef<TextInput | null>(null);
  const walkInContactRef = useRef<TextInput | null>(null);
  const productNameRef = useRef<TextInput | null>(null);

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  // Form state
  const [customerType, setCustomerType] = useState<'customer' | 'walk-in' | 'dealers'>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInContactNumber, setWalkInContactNumber] = useState('');
  const [walkInAddress, setWalkInAddress] = useState('');
  const [issueDate, setIssueDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [deliveryStatus, setDeliveryStatus] = useState('Pending');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [masterDiscount, setMasterDiscount] = useState('');
  const [stockType, setStockType] = useState<'send-now' | 'multi-ship'>('send-now');

  // Products
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: '1',
      product: '',
      shop: '',
      quantity: '1',
      rate: '0',
      discount: '0',
      tax: '0',
      description: '',
      price: '0',
    },
  ]);

  // Payment details
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([
    { id: '1', amount: '0', account: '', date: new Date().toLocaleDateString(), reference: '' },
  ]);

  // Temporary payment for modal
  const [tempPayment, setTempPayment] = useState<PaymentDetail>({
    id: '',
    amount: '0',
    account: '',
    date: new Date().toLocaleDateString(),
    reference: '',
  });


  // Payment modal mode: 'add' or 'edit'
  const [paymentModalMode, setPaymentModalMode] = useState<'add' | 'edit'>('add');

  // Temporary product for modal
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
    purchase_price: '0',
  });

  // Payment snap points for bottom sheet (use full height to remove top gap)
  const paymentSnapPoints = useMemo(() => ['100%'], []);
  // Product snap points for bottom sheet (use full height to remove top gap)
  const productSnapPoints = useMemo(() => ['100%'], []);

  // Product modal mode: 'add' or 'edit'
  const [productModalMode, setProductModalMode] = useState<'add' | 'edit'>('add');

  // Product editing ID tracker
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Product search state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Inline add form toggle (show small inline form instead of opening bottom sheet)
  // Keep inline form visible by default per user's request
  const [showInlineAdd, setShowInlineAdd] = useState(true);

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalType, setDateModalType] = useState<'issue' | 'due'>('issue');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(0);

  // Loading state for update
  const [isUpdating, setIsUpdating] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic dropdown data
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: number; name: string }>>([]);
  const [deliveryStatuses] = useState(['Pending', 'Processing', 'Shipped', 'Out for delivery', 'Delivered']);

  // Load invoice data when component mounts
  useEffect(() => {
    if (id) {
      loadInvoiceData(id);
      loadWarehouses();
      loadCategories();
    }
  }, [id]);

  // Auto-select category and warehouse after dynamic data is loaded
  useEffect(() => {
    if (loading || !categoryId || !categories.length) return;
    
    const matchedCategory = categories.find(cat => cat.id === categoryId);
    if (matchedCategory) {
      setSelectedCategory(matchedCategory.name);
      console.log('[EditInvoice] Auto-selected category:', matchedCategory.name);
    }
  }, [categories, categoryId, loading]);

  // If invoice has no categoryId, auto-select the first available category as a sensible default
  useEffect(() => {
    if (loading || categories.length === 0) return;
    if (!categoryId && !selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0].name);
      console.log('[EditInvoice] Auto-selected default category:', categories[0].name);
    }
  }, [categories, categoryId, selectedCategory, loading]);

  // Auto-select warehouse after dynamic data is loaded
  useEffect(() => {
    if (loading || !warehouseId || !warehouses.length) return;
    
    const matchedWarehouse = warehouses.find(wh => wh.id === warehouseId);
    if (matchedWarehouse) {
      setSelectedWarehouse(matchedWarehouse.name);
      console.log('[EditInvoice] Auto-selected warehouse:', matchedWarehouse.name);
    }
  }, [warehouses, warehouseId, loading]);

  // Function to load warehouses dynamically
  const loadWarehouses = async () => {
    try {
      console.log('[EditInvoice] Loading warehouses...');
      const warehouseList = await warehouseService.getLocalWarehouses();
      
      if (warehouseList && warehouseList.length > 0) {
        console.log('[EditInvoice] Loaded warehouses:', warehouseList);
        const formattedWarehouses = warehouseList.map((wh: any) => ({
          id: wh.id,
          name: wh.name,
        }));
        setWarehouses(formattedWarehouses);
      } else {
        console.log('[EditInvoice] No warehouses found in local DB, syncing from API...');
        // Try to sync from API
        const syncResult = await warehouseService.syncWarehouses();
        if (syncResult.success) {
          const updatedList = await warehouseService.getLocalWarehouses();
          const formattedWarehouses = updatedList.map((wh: any) => ({
            id: wh.id,
            name: wh.name,
          }));
          setWarehouses(formattedWarehouses);
          console.log('[EditInvoice] Warehouses synced:', formattedWarehouses);
        }
      }
    } catch (error) {
      console.error('[EditInvoice] Error loading warehouses:', error);
    }
  };

  // Function to load categories dynamically
  const loadCategories = async () => {
    try {
      console.log('[EditInvoice] Loading categories...');
      const categoryList = await categoryService.getLocalCategories();
      
      if (categoryList && categoryList.length > 0) {
        console.log('[EditInvoice] Loaded categories:', categoryList);
        const formattedCategories = categoryList.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
        }));
        setCategories(formattedCategories);
      } else {
        console.log('[EditInvoice] No categories found in local DB, syncing from API...');
        // Try to sync from API
        const syncResult = await categoryService.syncCategories();
        if (syncResult.success) {
          const updatedList = await categoryService.getLocalCategories();
          const formattedCategories = updatedList.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
          }));
          setCategories(formattedCategories);
          console.log('[EditInvoice] Categories synced:', formattedCategories);
        }
      }
    } catch (error) {
      console.error('[EditInvoice] Error loading categories:', error);
    }
  };

  // Helper to show validation alert and focus the related field when OK is pressed
  const showErrorAndFocus = useCallback((message: string, field?: string) => {
    Alert.alert('Error', message, [
      {
        text: 'OK',
        onPress: () => {
          try {
            switch (field) {
              case 'customer':
              case 'dealer':
                setShowCustomerModal(true);
                break;
              case 'walkInName':
                setTimeout(() => walkInNameRef.current?.focus(), 100);
                break;
              case 'walkInContact':
                setTimeout(() => walkInContactRef.current?.focus(), 100);
                break;
              case 'category':
                setShowCategoryModal(true);
                break;
              case 'warehouse':
                setShowWarehouseModal(true);
                break;
              case 'product':
                // open add-product sheet and focus product name input
                addProductBottomSheetRef.current?.snapToIndex(0);
                setTimeout(() => productNameRef.current?.focus(), 200);
                break;
              case 'payment':
                addPaymentBottomSheetRef.current?.snapToIndex(0);
                break;
              default:
                break;
            }
          } catch (e) {
            console.warn('[EditInvoice] showErrorAndFocus failed to focus field', e);
          }
        }
      }
    ]);
  }, []);

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

  const selectProductFromSuggestions = useCallback((product: any) => {
    console.log('[EditInvoice] Product selected:', product);

    // Clear search query first
    setProductSearchQuery('');
    setShowProductSuggestions(false);

    // Auto-fill product details
    setTempProduct(prev => {
      const updated = {
        ...prev,
        id: product.id.toString(),
        product: product.label,
        rate: product.sale_price || '0',
        description: product.description || '',
        quantity: '1',
        purchase_price: product.purchase_price || '0', // Store purchase price for validation
      };

      // Calculate price with the new rate
      const qty = parseFloat(updated.quantity) || 0;
      const rate = parseFloat(updated.rate) || 0;
      const discount = parseFloat(updated.discount) || 0;
      const subtotal = qty * rate;
      const discountAmount = (subtotal * discount) / 100;
      updated.price = (subtotal - discountAmount).toFixed(2);

      console.log('[EditInvoice] Product auto-filled:', updated);
      return updated;
    });
  }, []);

  // Function to load invoice data from API
  const loadInvoiceData = async (invoiceId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[EditInvoice] Loading invoice data for ID:', invoiceId);
      
      const data = await invoiceService.getInvoiceDetail(invoiceId);
      
      if (data) {
        const { invoice, items, payments, totals } = data;
        console.log('[EditInvoice] Loaded invoice data:', invoice);
        
        // Populate form fields with API data
        setInvoiceNumber(`#INVO${String(invoice.invoice_number).padStart(5, '0')}`);
        setSelectedCustomer(invoice.customer_name);
        setCustomerId(invoice.customer_id || null);
        setWalkInCustomerName('');
        setWalkInContactNumber(invoice.contact_number || '');
        setWalkInAddress(invoice.address || '');
        setIssueDate(new Date(invoice.issue_date));
        setDueDate(new Date(invoice.due_date));
        setDeliveryStatus(invoice.delivery_status);
        setReferenceNumber(invoice.ref_number || '');
        setMasterDiscount(invoice.discount_apply?.toString() || '0');
        
        // Set category ID (will be auto-selected once categories load)
        const categoryId = invoice.category_id || null;
        setCategoryId(categoryId);
        
        // Set warehouse ID (will be auto-selected once warehouses load)
        const warehouseId = invoice.warehouse_id || null;
        setWarehouseId(warehouseId);
        setCustomerType('customer');
        setStockType('send-now');
        
        // Populate products
        const productItems: ProductItem[] = items.map((item, index) => ({
          id: item.id.toString(),
          product: item.description,
          shop: 'Main Shop',
          quantity: item.quantity.toString(),
          rate: item.price,
          discount: item.discount_percentage || '0',
          tax: item.tax?.toString() || '0',
          description: item.description,
          price: item.subtotal.toString(),
          purchase_price: (item as any).cost_price || '0', // Store purchase price for validation
        }));
        
        if (productItems.length > 0) {
          setProducts(productItems);
        }
        
        // Populate payment details
        const paymentItems: PaymentDetail[] = payments.map((payment) => ({
          id: payment.id.toString(),
          amount: payment.amount,
          account: 'Cash Account',
          date: payment.date !== '0000-00-00' ? payment.date : new Date().toLocaleDateString(),
          reference: payment.reference || '',
        }));
        
        if (paymentItems.length > 0) {
          setPaymentDetails(paymentItems);
        }
        
        console.log('[EditInvoice] Invoice data loaded successfully');
      } else {
        setError('Invoice not found');
      }
    } catch (err: any) {
      console.error('[EditInvoice] Error loading invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

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
      purchase_price: '0',
    });
    setProductSearchQuery('');
    setShowProductSuggestions(false);
    setProductModalMode('add');
    addProductBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const editProduct = useCallback((product: ProductItem) => {
    // Set the product to edit
    setTempProduct(product);
    setEditingProductId(product.id);
    // Open bottom sheet
    addProductBottomSheetRef.current?.snapToIndex(0);
  }, []);

  // compute temp product amount for inline display
  const tempProductAmount = React.useMemo(() => {
    const qty = parseFloat(tempProduct.quantity) || 0;
    const rate = parseFloat(tempProduct.rate) || 0;
    const discount = parseFloat(tempProduct.discount) || 0;
    const subtotal = qty * rate;
    const discountAmount = (subtotal * discount) / 100;
    return (subtotal - discountAmount).toFixed(2);
  }, [tempProduct.quantity, tempProduct.rate, tempProduct.discount]);

  // Confirm add when using inline form (keeps inline visible)
  const confirmAddProductInline = useCallback(() => {
    if (!tempProduct.product.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }

    // compute final price to ensure quantity/rate/discount are applied
    const qty = parseFloat(tempProduct.quantity) || 0;
    const rate = parseFloat(tempProduct.rate) || 0;
    const discount = parseFloat(tempProduct.discount) || 0;
    const subtotal = qty * rate;
    const discountAmount = (subtotal * discount) / 100;
    const finalPrice = (subtotal - discountAmount).toFixed(2);

    if (editingProductId) {
      setProducts(prev => prev.map(p => p.id === editingProductId ? { ...tempProduct, price: finalPrice } : p));
      setEditingProductId(null);
    } else {
      setProducts(prev => [{ ...tempProduct, id: tempProduct.id || Date.now().toString(), price: finalPrice }, ...prev]);
    }

    // Reset inline temp product but keep inline form visible
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
      purchase_price: '0',
    });
    setProductSearchQuery('');
    setShowProductSuggestions(false);
  }, [tempProduct, editingProductId]);

  // Header add button handler: add current inline product
  const handleHeaderAddPress = useCallback(() => {
    confirmAddProductInline();
  }, [confirmAddProductInline]);

  const confirmAddProduct = useCallback(() => {
    // Validate required fields
    if (!tempProduct.product.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }

    console.log('[EditInvoice] Adding/Editing product:', tempProduct);

    // compute final price to ensure quantity/rate/discount are applied
    const qty = parseFloat(tempProduct.quantity) || 0;
    const rate = parseFloat(tempProduct.rate) || 0;
    const discount = parseFloat(tempProduct.discount) || 0;
    const subtotal = qty * rate;
    const discountAmount = (subtotal * discount) / 100;
    const finalPrice = (subtotal - discountAmount).toFixed(2);

    if (editingProductId) {
      // Update existing product with computed price
      setProducts(prev => prev.map(p => p.id === editingProductId ? { ...tempProduct, price: finalPrice } : p));
      setEditingProductId(null);
    } else {
      // Add new product with computed price (prepend so newest appears first)
      setProducts(prev => [{ ...tempProduct, id: tempProduct.id || Date.now().toString(), price: finalPrice }, ...prev]);
    }

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
      purchase_price: '0',
    });
  }, [tempProduct, editingProductId]);

  const updateTempProduct = useCallback((field: keyof ProductItem, value: string) => {
    setTempProduct(prev => {
      let updated = { ...prev, [field]: value };

      // Validate rate against purchase price
      if (field === 'rate') {
        const rateValue = parseFloat(value) || 0;
        const purchasePrice = parseFloat(updated.purchase_price || '0') || 0;
        
        // Only prevent rate less than purchase price
        if (purchasePrice > 0 && rateValue > 0 && rateValue < purchasePrice) {
          Alert.alert(
            'Invalid Rate',
            `Rate cannot be less than purchase price `,
            [{ text: 'OK' }]
          );
          // Reset to purchase price
          updated.rate = purchasePrice.toString();
        }
      }
      
      // Recalculate price when quantity or rate changes
      if (field === 'quantity' || field === 'rate' || field === 'discount') {
        const quantity = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
        const rate = parseFloat(field === 'rate' ? value : updated.rate) || 0;
        const discount = parseFloat(field === 'discount' ? value : updated.discount) || 0;
        
        const subtotal = quantity * rate;
        const discountAmount = (subtotal * discount) / 100;
        const finalPrice = subtotal - discountAmount;
        
        updated.price = finalPrice.toFixed(2);
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
          const quantity = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
          const rate = parseFloat(field === 'rate' ? value : updated.rate) || 0;
          const discount = parseFloat(field === 'discount' ? value : updated.discount) || 0;
          
          const subtotal = quantity * rate;
          const discountAmount = (subtotal * discount) / 100;
          const finalPrice = subtotal - discountAmount;
          
          updated.price = finalPrice.toFixed(2);
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
    setPaymentModalMode('add');
    addPaymentBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const editPayment = useCallback((payment: PaymentDetail) => {
    // Load payment into temp and show bottom sheet
    setTempPayment(payment);
    setPaymentModalMode('edit');
    addPaymentBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const confirmAddPayment = useCallback(() => {
    // Validate required fields
    if (!tempPayment.account.trim()) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    if (paymentModalMode === 'add') {
      // Add the payment to the list
      setPaymentDetails(prev => [...prev, { ...tempPayment, id: Date.now().toString() }]);
    } else {
      // Update existing payment
      setPaymentDetails(prevPayments => prevPayments.map(payment =>
        payment.id === tempPayment.id ? tempPayment : payment
      ));
    }

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
  }, [tempPayment, paymentModalMode]);

  const updateTempPayment = useCallback((field: keyof PaymentDetail, value: string) => {
    setTempPayment(prev => ({ ...prev, [field]: value }));
  }, []);

  const removePayment = useCallback((id: string) => {
    Alert.alert('Delete Payment', 'Are you sure you want to delete this payment?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Delete',
        onPress: () => {
          setPaymentDetails(prevPayments => {
            if (prevPayments.length > 1) {
              return prevPayments.filter(payment => payment.id !== id);
            }
            Alert.alert('Error', 'Invoice must have at least one payment record');
            return prevPayments;
          });
        },
        style: 'destructive',
      },
    ]);
  }, []);

  const handleUpdate = async () => {
    // Validate required fields
    if (customerType === 'customer' && !selectedCustomer) {
      showErrorAndFocus('Please select a customer', 'customer');
      return;
    }

    if (customerType === 'walk-in') {
      if (!walkInCustomerName.trim()) {
        showErrorAndFocus('Please enter customer name', 'walkInName');
        return;
      }
      if (!walkInContactNumber.trim()) {
        showErrorAndFocus('Please enter contact number', 'walkInContact');
        return;
      }
    }

    if (customerType === 'dealers' && !selectedCustomer) {
      showErrorAndFocus('Please select a dealer', 'dealer');
      return;
    }

    if (!selectedCategory) {
      showErrorAndFocus('Please select a category', 'category');
      return;
    }

    if (!selectedWarehouse) {
      showErrorAndFocus('Please select a warehouse', 'warehouse');
      return;
    }

    if (products.some(p => !p.product.trim())) {
      showErrorAndFocus('Please fill in all product details', 'product');
      return;
    }

    try {
      setIsUpdating(true);
      console.log('[EditInvoice] Updating invoice with ID:', id);

      // Prepare update payload
      const updatePayload = {
        issue_date: issueDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        category_id: categoryId || 9,
        warehouse_id: warehouseId || 1,
        customer_id: customerId || 251,
        delivery_status: deliveryStatus,
        sale_type: 'single_warehouse',
        ref_number: referenceNumber || '',
        discount_apply: parseFloat(masterDiscount || '0'),
        items: products.map((product) => ({
          id: parseInt(product.id) || 0,
          quantity: parseInt(product.quantity) || 0,
          price: parseFloat(product.rate) || 0,
          description: product.description,
        })),
        payments: paymentDetails.map((payment) => ({
          date: payment.date,
          amount: parseFloat(payment.amount) || 0,
          account_id: 4, // You may need to make this dynamic
          payment_method: 1, // You may need to make this dynamic
          reference: payment.reference || '',
          description: '',
        })),
      };

      console.log('[EditInvoice] Update payload:', updatePayload);

      const result = await invoiceService.updateInvoice(id, updatePayload);
      
      // Safety check - ensure result is defined
      if (!result) {
        console.error('[EditInvoice] updateInvoice returned null/undefined');
        Alert.alert('Error', 'Failed to get response from server');
        setIsUpdating(false);
        return;
      }

      if (result.success === true) {
        console.log('[EditInvoice] Invoice updated successfully');
        const total = typeof result.total === 'number' ? result.total : 0;
        const paid = typeof result.paid === 'number' ? result.paid : 0;
        const due = typeof result.due === 'number' ? result.due : 0;
        Alert.alert('Success', `${result.message || 'Invoice updated successfully'}\n\nTotal: Rs. ${total}\nPaid: Rs. ${paid}\nDue: Rs. ${due}`, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        console.log('[EditInvoice] Update failed - result:', result);
        const errorMessage = result?.message || 'Failed to update invoice';
        Alert.alert('Error', errorMessage);
      }
    } catch (error: any) {
      console.error('[EditInvoice] Error updating invoice:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Changes',
      'Are you sure you want to cancel? All changes will be lost.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Cancel Changes', style: 'destructive', onPress: () => router.back() }
      ]
    );
  };

  // Memoized ProductItem component for better performance (Table Row)
  const ProductItemComponent = React.memo(({ 
    product, 
    index, 
    onUpdate, 
    onEdit,
    onRemove, 
    canRemove 
  }: {
    product: ProductItem;
    index: number;
    onUpdate: (id: string, field: keyof ProductItem, value: string) => void;
    onEdit: (product: ProductItem) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
  }) => {
    return (
      <View style={stylesLocal.tableRow}>
        <TouchableOpacity style={[stylesLocal.tableCell, stylesLocal.tableCellProduct]} onPress={() => onEdit(product)}>
          <Text numberOfLines={1} style={{ color: icon }}>{product.product || 'Item'}</Text>
        </TouchableOpacity>
        <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellFlexSmall]}
          value={product.quantity}
          onChangeText={(value) => onUpdate(product.id, 'quantity', value)}
          placeholder="Qty"
          placeholderTextColor={icon}
          keyboardType="numeric"
        />
        {/* <TextInput
          style={[stylesLocal.tableCell, stylesLocal.tableCellFlexMedium]}
          value={product.rate}
          onChangeText={(value) => onUpdate(product.id, 'rate', value)}
          placeholder="Rate"
          placeholderTextColor={icon}
          keyboardType="numeric"
        /> */}
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellFlexPrice]}>{product.price}</Text>
        <View style={stylesLocal.tableActionsCell}>
          <TouchableOpacity
            onPress={() => onEdit(product)}
            style={stylesLocal.tableEditBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="edit" size={resp.fontSize(16)} color="#3b82f6" />
          </TouchableOpacity>
          {canRemove && (
            <TouchableOpacity
              onPress={() => onRemove(product.id)}
              style={stylesLocal.tableDeleteBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="delete-outline" size={resp.fontSize(16)} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  });

  // Render item function for FlatList
  const renderProductItem = useCallback(({ item, index }: { item: ProductItem; index: number }) => {
    return (
      <ProductItemComponent
        product={item}
        index={index}
        onUpdate={updateProduct}
        onEdit={editProduct}
        onRemove={removeProduct}
        canRemove={true}
      />
    );
  }, [updateProduct, editProduct, removeProduct]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: ProductItem) => item.id, []);

  // List header component - empty since we moved header outside
  const ListHeaderComponent = useMemo(() => null, []);

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

  // Memoized PaymentItem component - table row with edit/delete actions
  const PaymentItemComponent = React.memo(({ 
    payment, 
    index, 
    onEdit,
    onRemove,
    canRemove
  }: {
    payment: PaymentDetail;
    index: number;
    onEdit: (payment: PaymentDetail) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
  }) => {
    return (
      <View style={stylesLocal.paymentTableRow}>
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellIndex]}>{index + 1}</Text>
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellFlexSmall]}>{payment.amount}</Text>
        <Text style={[stylesLocal.tableCell, stylesLocal.tableCellFlexMedium]} numberOfLines={1}>{payment.account || 'Select'}</Text>
        {/* <Text style={[stylesLocal.tableCell, stylesLocal.tableCellFlexSmall]}>{payment.date}</Text> */}
        <View style={stylesLocal.tableActionsCell}>
          <TouchableOpacity
            onPress={() => onEdit(payment)}
            style={stylesLocal.tableEditBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="edit" size={resp.fontSize(16)} color="#3b82f6" />
          </TouchableOpacity>
          {canRemove && (
            <TouchableOpacity
              onPress={() => onRemove(payment.id)}
              style={stylesLocal.tableDeleteBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="delete-outline" size={resp.fontSize(16)} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  });

  // Render payment item function for FlatList
  const renderPaymentItem = useCallback(({ item, index }: { item: PaymentDetail; index: number }) => {
    return (
      <PaymentItemComponent
        payment={item}
        index={index}
        onEdit={editPayment}
        onRemove={removePayment}
        canRemove={true}
      />
    );
  }, [editPayment, removePayment]);

  // Payment key extractor
  const paymentKeyExtractor = useCallback((item: PaymentDetail) => item.id, []);

  // Payment list header - empty since we moved header outside
  const PaymentListHeaderComponent = useMemo(() => null, []);

  // Payment list footer (payment summary)
  const PaymentListFooterComponent = useMemo(() => (
    <View style={stylesLocal.totalsCard}>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Total Amount:</Text>
        <Text style={stylesLocal.totalValue}>{totals.total} Rs.</Text>
      </View>
      <View style={stylesLocal.totalRow}>
        <Text style={stylesLocal.totalLabel}>Paid:</Text>
        <Text style={[stylesLocal.totalValue, { color: '#27ae60' }]}>+{totals.paid} Rs.</Text>
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
    options: string[]; 
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
                key={option}
                style={stylesLocal.modalItem}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text style={stylesLocal.modalItemText}>{option}</Text>
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
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <Text key={d} style={stylesLocal.weekday}>{d}</Text>
            ))}
          </View>
          {weeks.map((week, idx) => (
            <View key={idx} style={stylesLocal.weekRow}>
              {week.map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={day ? stylesLocal.dayBtn : stylesLocal.dayBtnEmpty}
                  disabled={!day}
                  onPress={() => {
                    if (!day) return;
                    const selectedDate = new Date(year, month, day);
                    onSelect(selectedDate);
                    onClose();
                  }}
                >
                  <Text style={stylesLocal.dayText}>{day ?? ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </Modal>
    );
  }

  // Render backdrop for payment bottom sheet
  const renderPaymentBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} opacity={0.6} />
    ),
    []
  );

  // Render backdrop for product bottom sheet
  const renderProductBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} opacity={0.6} />
    ),
    []
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ThemedView style={[stylesLocal.container, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={stylesLocal.header}>
          <TouchableOpacity style={stylesLocal.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={resp.fontSize(20)} color={text} />
          </TouchableOpacity>
          <Text style={stylesLocal.headerTitle}>Edit Invoice</Text>
          <View style={stylesLocal.headerSpacer} />
        </View>

        {/* Loading State */}
        {loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={tint} />
            <Text style={{ marginTop: 16, color: text, fontSize: resp.fontSize(14) }}>Loading invoice...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: resp.horizontalScale(20) }}>
            <Text style={{ color: '#e74c3c', fontSize: resp.fontSize(16), marginBottom: 20, textAlign: 'center' }}>
              {error}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: tint, paddingHorizontal: resp.horizontalScale(24), paddingVertical: resp.vertical(12), borderRadius: resp.horizontalScale(8) }}
              onPress={() => id && loadInvoiceData(id)}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: resp.fontSize(14) }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Form Content */}
        {!loading && !error && (
        <ScrollView 
          ref={mainScrollViewRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer Type Section */}
          <View style={stylesLocal.section}>
            <Text style={stylesLocal.sectionTitle}>Customer Information</Text>
            
            <View style={stylesLocal.radioGroup}>
              <TouchableOpacity
                style={stylesLocal.radioOption}
                onPress={() => setCustomerType('customer')}
              >
                <View style={[stylesLocal.radio, customerType === 'customer' && stylesLocal.radioSelected]} />
                <Text style={stylesLocal.radioText}>Customer</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={stylesLocal.radioOption}
                onPress={() => setCustomerType('walk-in')}
              >
                <View style={[stylesLocal.radio, customerType === 'walk-in' && stylesLocal.radioSelected]} />
                <Text style={stylesLocal.radioText}>Walk-in Customer</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={stylesLocal.radioOption}
                onPress={() => setCustomerType('dealers')}
              >
                <View style={[stylesLocal.radio, customerType === 'dealers' && stylesLocal.radioSelected]} />
                <Text style={stylesLocal.radioText}>Dealers</Text>
              </TouchableOpacity>
            </View>

            {customerType === 'customer' || customerType === 'dealers' ? (
              <TouchableOpacity
                style={stylesLocal.input}
                onPress={() => setShowCustomerModal(true)}
              >
                <Text style={[stylesLocal.inputText, { color: selectedCustomer ? text : icon }]}>
                  {selectedCustomer || `Select ${customerType === 'dealers' ? 'Dealer' : 'Customer'}`}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
              </TouchableOpacity>
            ) : (
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <TextInput
                    style={stylesLocal.textInput}
                    placeholder="Customer Name"
                    placeholderTextColor={icon}
                    value={walkInCustomerName}
                    onChangeText={setWalkInCustomerName}
                    ref={walkInNameRef}
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <TextInput
                    style={stylesLocal.textInput}
                    placeholder="Contact Number"
                    placeholderTextColor={icon}
                    value={walkInContactNumber}
                    onChangeText={setWalkInContactNumber}
                    ref={walkInContactRef}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            )}

            {customerType === 'walk-in' && (
              <TextInput
                style={stylesLocal.textInput}
                placeholder="Address"
                placeholderTextColor={icon}
                value={walkInAddress}
                onChangeText={setWalkInAddress}
                multiline
              />
            )}
          </View>

          {/* Invoice Details Section */}
          <View style={stylesLocal.section}>
            <Text style={stylesLocal.sectionTitle}>Invoice Details</Text>
            
            <View style={[stylesLocal.row, { marginBottom: resp.vertical(12) }]}>
              <View style={stylesLocal.halfWidth}>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => {
                    setDateModalType('issue');
                    setShowDateModal(true);
                  }}
                >
                  <Text style={stylesLocal.inputText}>{formatDate(issueDate)}</Text>
                  <MaterialIcons name="calendar-today" size={resp.fontSize(18)} color={icon} />
                </TouchableOpacity>
              </View>
              <View style={stylesLocal.halfWidth}>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => {
                    setDateModalType('due');
                    setShowDateModal(true);
                  }}
                >
                  <Text style={stylesLocal.inputText}>{formatDate(dueDate)}</Text>
                  <MaterialIcons name="calendar-today" size={resp.fontSize(18)} color={icon} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[stylesLocal.row, { marginBottom: resp.vertical(12) }]}>
              <View style={stylesLocal.halfWidth}>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => setShowDeliveryModal(true)}
                >
                  <Text style={stylesLocal.inputText}>{deliveryStatus}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
              <View style={stylesLocal.halfWidth}>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={[stylesLocal.inputText, { color: selectedCategory ? text : icon }]}>
                    {selectedCategory || 'Select Category'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[stylesLocal.row, { marginBottom: resp.vertical(12) }]}>
              <View style={stylesLocal.halfWidth}>
                <TextInput
                  style={stylesLocal.textInput}
                  placeholder="Invoice Number"
                  placeholderTextColor={icon}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  editable={false}
                />
              </View>
              <View style={stylesLocal.halfWidth}>
                <TouchableOpacity
                  style={stylesLocal.input}
                  onPress={() => setShowWarehouseModal(true)}
                >
                  <Text style={[stylesLocal.inputText, { color: selectedWarehouse ? text : icon }]}>
                    {selectedWarehouse || 'Select Warehouse'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* <View style={stylesLocal.row}>
              <View style={stylesLocal.halfWidth}>
                <TextInput
                  style={stylesLocal.textInput}
                  placeholder="Reference Number"
                  placeholderTextColor={icon}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </View>
            </View> */}
          </View>

          {/* Products Section */}
          <View style={stylesLocal.section}>
            <View style={stylesLocal.sectionHeader}>
              <Text style={stylesLocal.sectionTitle}>Products</Text>
              <TouchableOpacity
                style={stylesLocal.addButton}
                onPress={handleHeaderAddPress}
              >
                <MaterialIcons name="add" size={resp.fontSize(16)} color="#ffffff" />
                <Text style={stylesLocal.addButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>

            {/* Inline compact add form (mirrors CreateInvoice) */}
            {showInlineAdd && (
              <View style={[stylesLocal.productCard, { marginBottom: resp.vertical(12) }]}> 
                <View style={{ flexDirection: 'row', gap: resp.horizontalScale(8), alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={stylesLocal.formLabel}>Items*</Text>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        style={stylesLocal.formInput}
                        placeholder="Search items..."
                        placeholderTextColor={icon}
                        value={productSearchQuery || tempProduct.product}
                        onChangeText={(value) => {
                          setProductSearchQuery(value);
                          updateTempProduct('product', value);
                          if (value.trim()) setShowProductSuggestions(true);
                        }}
                        onFocus={() => { if (productSuggestions.length > 0) setShowProductSuggestions(true); }}
                      />
                      {isSearchingProducts && (
                        <View style={stylesLocal.searchLoader}>
                          <Text style={{ color: icon, fontSize: resp.fontSize(12) }}>Searching...</Text>
                        </View>
                      )}
                      {showProductSuggestions && productSuggestions.length > 0 && (
                        <View style={stylesLocal.suggestionsContainer}>
                          <ScrollView style={stylesLocal.suggestionsList} nestedScrollEnabled>
                            {productSuggestions.map((item) => (
                              <TouchableOpacity key={item.id.toString()} style={stylesLocal.suggestionItem} onPress={() => selectProductFromSuggestions(item)}>
                                <Text style={[stylesLocal.suggestionText, { color: text }]}>{item.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ width: resp.horizontalScale(72) }}>
                    <Text style={stylesLocal.formLabel}>Quantity*</Text>
                    <TextInput
                      style={stylesLocal.formInput}
                      value={tempProduct.quantity}
                      onChangeText={(value) => updateTempProduct('quantity', value)}
                      placeholder="Qty"
                      placeholderTextColor={icon}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ width: resp.horizontalScale(100) }}>
                    <Text style={stylesLocal.formLabel}>Price*</Text>
                    <TextInput
                      style={stylesLocal.formInput}
                      value={tempProduct.rate}
                      onChangeText={(value) => updateTempProduct('rate', value)}
                      placeholder="Price"
                      placeholderTextColor={icon}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={{ marginTop: resp.vertical(8) }}>
                  <Text style={stylesLocal.formLabel}>Description</Text>
                  <TextInput
                    style={[stylesLocal.formInput, { height: resp.vertical(64), textAlignVertical: 'top' }]}
                    value={tempProduct.description}
                    onChangeText={(v) => updateTempProduct('description', v)}
                    placeholder="Description"
                    placeholderTextColor={icon}
                    multiline
                  />
                </View>
                <View style={[stylesLocal.priceRow, { marginTop: resp.vertical(10) }]}> 
                  <Text style={stylesLocal.priceLabel}>Amount:</Text>
                  <Text style={stylesLocal.priceValue}>{tempProductAmount} Rs.</Text>
                </View>
              </View>
            )}

            <View style={stylesLocal.productsContainer}>
              <View style={stylesLocal.tableHeader}>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellProduct]}>Product</Text>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexSmall]}>Qty</Text>
                {/* <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexMedium]}>Rate</Text> */}
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexPrice]}>Amount</Text>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableActionsHeader]}>Action</Text>
              </View>
              <FlatList
                ref={productsListRef}
                data={products}
                renderItem={renderProductItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeaderComponent}
                ListFooterComponent={ListFooterComponent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Payment Details Section */}
          <View style={stylesLocal.section}>
            <View style={stylesLocal.sectionHeader}>
              <Text style={stylesLocal.sectionTitle}>Payment Details</Text>
              <TouchableOpacity
                style={stylesLocal.addButton}
                onPress={addPayment}
              >
                <MaterialIcons name="add" size={resp.fontSize(16)} color="#ffffff" />
                <Text style={stylesLocal.addButtonText}>Add Payment</Text>
              </TouchableOpacity>
            </View>

            <View style={stylesLocal.productsContainer}>
              <View style={stylesLocal.tableHeader}>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellIndex]}>#</Text>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexSmall]}>Amount</Text>
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexMedium]}>Account</Text>
                {/* <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableCellFlexSmall]}>Date</Text> */}
                <Text style={[stylesLocal.tableHeaderCell, stylesLocal.tableActionsHeader]}>Action</Text>
              </View>
              <FlatList
                ref={paymentsListRef}
                data={paymentDetails}
                renderItem={renderPaymentItem}
                keyExtractor={paymentKeyExtractor}
                ListHeaderComponent={PaymentListHeaderComponent}
                ListFooterComponent={PaymentListFooterComponent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          </View>
        </ScrollView>
        )}

        {/* Bottom Actions */}
        {!loading && !error && (
        <View style={stylesLocal.bottomActions}>
          <TouchableOpacity
            style={stylesLocal.cancelButton}
            onPress={handleCancel}
          >
            <Text style={stylesLocal.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[stylesLocal.createButton, isUpdating && { opacity: 0.6 }]}
            onPress={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={stylesLocal.createButtonText}>Update Invoice</Text>
            )}
          </TouchableOpacity>
        </View>
        )}        {/* Modals */}
        <DropdownModal
          visible={showCustomerModal}
          title={customerType === 'dealers' ? 'Select Dealer' : 'Select Customer'}
          options={customers.map(c => c.name)}
          onClose={() => setShowCustomerModal(false)}
          onSelect={setSelectedCustomer}
        />

        <DropdownModal
          visible={showCategoryModal}
          title="Select Category"
          options={categories.map(c => c.name)}
          onClose={() => setShowCategoryModal(false)}
          onSelect={(categoryName) => {
            setSelectedCategory(categoryName);
            const cat = categories.find(c => c.name === categoryName);
            if (cat) setCategoryId(cat.id);
          }}
        />

        <DropdownModal
          visible={showWarehouseModal}
          title="Select Warehouse"
          options={warehouses.map(w => w.name)}
          onClose={() => setShowWarehouseModal(false)}
          onSelect={(warehouseName) => {
            setSelectedWarehouse(warehouseName);
            const wh = warehouses.find(w => w.name === warehouseName);
            if (wh) setWarehouseId(wh.id);
          }}
        />

        <DropdownModal
          visible={showDeliveryModal}
          title="Select Delivery Status"
          options={deliveryStatuses}
          onClose={() => setShowDeliveryModal(false)}
          onSelect={setDeliveryStatus}
        />

        <DropdownModal
          visible={showAccountModal}
          title="Select Account"
          options={SAMPLE_ACCOUNTS}
          onClose={() => setShowAccountModal(false)}
          onSelect={(account) => {
            updateTempPayment('account', account);
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
            setShowDateModal(false);
          }}
        />

        {/* Product Bottom Sheet Modal */}
        <BottomSheet
          ref={addProductBottomSheetRef}
          index={-1}
          snapPoints={productSnapPoints}
          enablePanDownToClose={true}
          backdropComponent={renderProductBackdrop}
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
              addProductBottomSheetRef.current?.close();
            }} style={stylesLocal.modalCloseBtn}>
              <MaterialIcons name="close" size={resp.fontSize(24)} color={icon} />
            </TouchableOpacity>
            <Text style={stylesLocal.bottomSheetTitle}>{productModalMode === 'add' ? 'Add Product' : 'Edit Product'}</Text>
            <View style={{ width: resp.horizontalScale(40) }} />
          </View>

          <BottomSheetScrollView
            contentContainerStyle={stylesLocal.bottomSheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={stylesLocal.modalForm}>
              {/* Product Name with Search */}
              <View style={stylesLocal.formRow}>
                <Text style={stylesLocal.formLabel}>Product Name *</Text>
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
                    ref={productNameRef}
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

              {/* Quantity and Rate */}
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <Text style={stylesLocal.formLabel}>Quantity *</Text>
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
                  <Text style={stylesLocal.formLabel}>Rate/Price *</Text>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempProduct.rate}
                    onChangeText={(value) => updateTempProduct('rate', value)}
                    placeholder="0"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Discount and Tax */}
              <View style={stylesLocal.row}>
                <View style={stylesLocal.halfWidth}>
                  <Text style={stylesLocal.formLabel}>Discount %</Text>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempProduct.discount}
                    onChangeText={(value) => updateTempProduct('discount', value)}
                    placeholder="0"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <Text style={stylesLocal.formLabel}>Tax %</Text>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempProduct.tax}
                    onChangeText={(value) => updateTempProduct('tax', value)}
                    placeholder="0"
                    placeholderTextColor={icon}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Description */}
              <View style={stylesLocal.formRow}>
                <Text style={stylesLocal.formLabel}>Description</Text>
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

              {/* Total Price Display */}
              <View style={stylesLocal.priceRow}>
                <Text style={stylesLocal.priceLabel}>Total Price:</Text>
                <Text style={stylesLocal.priceValue}>{tempProduct.price} Rs.</Text>
              </View>
            </View>
          </BottomSheetScrollView>

          <View style={stylesLocal.bottomSheetFooter}>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalCancelButton]}
              onPress={() => {
                Keyboard.dismiss();
                addProductBottomSheetRef.current?.close();
              }}
            >
              <Text style={stylesLocal.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[stylesLocal.modalButton, stylesLocal.modalAddButton]}
              onPress={confirmAddProduct}
            >
              <Text style={stylesLocal.modalAddButtonText}>{productModalMode === 'add' ? 'Add Product' : 'Update Product'}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>

        {/* Payment Bottom Sheet Modal */}
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
            <Text style={stylesLocal.bottomSheetTitle}>{paymentModalMode === 'add' ? 'Add Payment' : 'Edit Payment'}</Text>
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
                  <Text style={stylesLocal.formLabel}>Amount *</Text>
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
                  <Text style={stylesLocal.formLabel}>Account *</Text>
                  <TouchableOpacity
                    style={stylesLocal.input}
                    onPress={() => setShowAccountModal(true)}
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
                  <Text style={stylesLocal.formLabel}>Date</Text>
                  <TextInput
                    style={stylesLocal.formInput}
                    value={tempPayment.date}
                    onChangeText={(value) => updateTempPayment('date', value)}
                    placeholder="11/05/2025"
                    placeholderTextColor={icon}
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <Text style={stylesLocal.formLabel}>Reference</Text>
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
              <Text style={stylesLocal.modalAddButtonText}>{paymentModalMode === 'add' ? 'Add Payment' : 'Update Payment'}</Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      </ThemedView>
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
      padding: resp.horizontalScale(4),
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      backgroundColor: '#f39c12',
      borderRadius: resp.horizontalScale(12),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#f39c12',
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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
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
    // Responsive flex-based table cells for mobile
    tableCellFlexSmall: {
      flex: 0.6,
      margin: resp.horizontalScale(4),
      fontWeight: '500',
    },
    tableCellFlexMedium: {
      flex: 0.8,
      fontWeight: '500',
    },
    tableCellFlexPrice: {
      flex: 0.9,
      fontWeight: '600',
      color: '#059669',
    },
    // Action column styles
    tableActionsCell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flex: 1.2,
      gap: resp.horizontalScale(8),
    },
    tableActionsHeader: {
      flex: 1.2,
      textAlign: 'center',
    },
    tableEditBtn: {
      width: resp.horizontalScale(32),
      height: resp.horizontalScale(32),
      borderRadius: resp.horizontalScale(16),
      backgroundColor: '#dbeafe',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tableDeleteBtn: {
      width: resp.horizontalScale(32),
      height: resp.horizontalScale(32),
      borderRadius: resp.horizontalScale(16),
      backgroundColor: '#fee2e2',
      justifyContent: 'center',
      alignItems: 'center',
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
    // Payment card styles for clickable payment items
    paymentCardClickable: {
      backgroundColor: theme.bg === Colors.light.background ? '#f0f9ff' : '#0f172a',
      borderRadius: resp.horizontalScale(12),
      padding: resp.horizontalScale(16),
      marginBottom: resp.vertical(12),
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#bae6fd' : '#1e40af',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    paymentRowContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    paymentRowInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: resp.horizontalScale(12),
    },
    paymentRowIndex: {
      fontSize: resp.fontSize(14),
      fontWeight: '600',
      color: theme.tint,
      width: resp.horizontalScale(28),
    },
    paymentRowDetails: {
      flex: 1,
    },
    paymentAmount: {
      fontSize: resp.fontSize(14),
      fontWeight: '600',
      color: theme.text,
      marginBottom: resp.vertical(2),
    },
    paymentAccount: {
      fontSize: resp.fontSize(12),
      color: theme.icon,
      fontWeight: '400',
    },
    paymentRowMeta: {
      alignItems: 'flex-end',
      gap: resp.horizontalScale(8),
    },
    paymentDate: {
      fontSize: resp.fontSize(12),
      color: theme.icon,
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
    modalCloseBtn: {
      width: resp.horizontalScale(40),
      height: resp.horizontalScale(40),
      borderRadius: resp.horizontalScale(20),
      backgroundColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalForm: {
      gap: resp.vertical(16),
      paddingBottom: resp.vertical(20),
    },
    // Product search styles
    searchLoader: {
      position: 'absolute',
      right: resp.horizontalScale(12),
      top: '50%',
      transform: [{ translateY: -12 }],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionsContainer: {
      position: 'absolute',
      top: resp.vertical(48),
      left: 0,
      right: 0,
      maxHeight: resp.vertical(200),
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
      borderWidth: 1,
      borderColor: theme.bg === Colors.light.background ? '#e2e8f0' : '#475569',
      borderRadius: resp.horizontalScale(10),
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      zIndex: 1000,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
    suggestionsList: {
      maxHeight: resp.vertical(200),
    },
    suggestionItem: {
      paddingVertical: resp.vertical(12),
      paddingHorizontal: resp.horizontalScale(16),
      borderBottomWidth: 0.5,
      borderBottomColor: theme.bg === Colors.light.background ? '#f1f5f9' : '#334155',
      backgroundColor: theme.bg === Colors.light.background ? '#ffffff' : '#1e293b',
    },
    suggestionText: {
      fontSize: resp.fontSize(15),
      fontWeight: '400',
      letterSpacing: -0.1,
    },
  });