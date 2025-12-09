import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const SAMPLE_CUSTOMERS = [
  'Yasir Foam Center',
  'Master Display Timber [Zubair]',
  'Acme Supplies',
  'Al-Noor Electronics',
  'Bright Furniture Works',
  'TechZone Computers',
  'Smart Home Solutions',
  'City Light Traders',
  'Metro Construction Co.',
  'Premier Paints & Coatings',
];

const SAMPLE_CATEGORIES = [
  'Foam Products',
  'Timber & Wood',
  'Electronics',
  'Furniture',
  'Construction Materials',
  'Hardware',
  'Paints & Coatings',
];

const SAMPLE_SHOPS = [
  'Main Shop',
  'Outlet A',
  'Outlet B',
  'MASHAALLAH FOAM ABDALI ROAD',
  'Anas Foam House',
];

const SAMPLE_ACCOUNTS = [
  'Cash Account',
  'Bank Account - HBL',
  'Bank Account - UBL',
  'Petty Cash',
];

// Sample invoice data for editing
const SAMPLE_INVOICE_DATA = {
  '1': {
    customerType: 'customer' as 'customer' | 'walk-in' | 'dealers',
    selectedCustomer: 'Yasir Foam Center',
    walkInCustomerName: '',
    walkInContactNumber: '',
    walkInAddress: '',
    issueDate: new Date('2025-09-21'),
    dueDate: new Date('2025-09-21'),
    deliveryStatus: 'Pending',
    invoiceNumber: '#INVO00003',
    referenceNumber: 'REF-001',
    selectedCategory: 'Foam Products',
    masterDiscount: '5',
    stockType: 'send-now' as 'send-now' | 'multi-ship',
    products: [
      {
        id: '1',
        product: 'مولٹی فوم',
        shop: 'Main Shop',
        quantity: '4',
        rate: '423.00',
        discount: '5',
        tax: '0',
        description: 'فوم کی اقسام اور فوم کمپنی',
        price: '1,607.40',
      },
        {
        id: '1',
        product: 'مولٹی فوم',
        shop: 'Main Shop 2',
        quantity: '4',
        rate: '423.00',
        discount: '5',
        tax: '0',
        description: 'فوم کی اقسام اور فوم کمپنی',
        price: '1,607.40',
      },
    ],
    paymentDetails: [
      {
        id: '1',
        amount: '1000',
        account: 'Cash Account',
        date: new Date().toLocaleDateString(),
        reference: 'PAY-001',
      },
    ],
  },
  '2': {
    customerType: 'customer' as 'customer' | 'walk-in' | 'dealers',
    selectedCustomer: 'Master Display Timber [Zubair]',
    walkInCustomerName: '',
    walkInContactNumber: '',
    walkInAddress: '',
    issueDate: new Date('2025-09-21'),
    dueDate: new Date('2025-09-21'),
    deliveryStatus: 'Processing',
    invoiceNumber: '#INVO00004',
    referenceNumber: 'REF-002',
    selectedCategory: 'Timber & Wood',
    masterDiscount: '10',
    stockType: 'multi-ship' as 'send-now' | 'multi-ship',
    products: [
      {
        id: '1',
        product: 'Oak Wood Panels',
        shop: 'Outlet A',
        quantity: '10',
        rate: '2500.00',
        discount: '10',
        tax: '5',
        description: 'Premium oak wood panels for furniture',
        price: '23,625.00',
      },
    ],
    paymentDetails: [
      {
        id: '1',
        amount: '15000',
        account: 'Bank Account - HBL',
        date: new Date().toLocaleDateString(),
        reference: 'PAY-002',
      },
    ],
  },
  '3': {
    customerType: 'walk-in' as 'customer' | 'walk-in' | 'dealers',
    selectedCustomer: null,
    walkInCustomerName: 'Ahmed Khan',
    walkInContactNumber: '+92-300-1234567',
    walkInAddress: 'Street 15, Block A, City Plaza',
    issueDate: new Date('2025-10-01'),
    dueDate: new Date('2025-10-10'),
    deliveryStatus: 'Pending',
    invoiceNumber: '#INVO00005',
    referenceNumber: 'REF-003',
    selectedCategory: 'Electronics',
    masterDiscount: '0',
    stockType: 'send-now' as 'send-now' | 'multi-ship',
    products: [
      {
        id: '1',
        product: 'LED TV 55 inch',
        shop: 'Main Shop',
        quantity: '1',
        rate: '12000.00',
        discount: '0',
        tax: '0',
        description: 'Samsung 55 inch Smart LED TV',
        price: '12,000.00',
      },
    ],
    paymentDetails: [
      {
        id: '1',
        amount: '0',
        account: '',
        date: new Date().toLocaleDateString(),
        reference: '',
      },
    ],
  },
  // Add more sample data for other invoices as needed
};

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

  const stylesLocal = createStyles(resp, { bg, text, tint, icon });

  // Form state
  const [customerType, setCustomerType] = useState<'customer' | 'walk-in' | 'dealers'>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
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

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalType, setDateModalType] = useState<'issue' | 'due'>('issue');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(0);

  // Load invoice data when component mounts
  useEffect(() => {
    if (id && SAMPLE_INVOICE_DATA[id as keyof typeof SAMPLE_INVOICE_DATA]) {
      const invoiceData = SAMPLE_INVOICE_DATA[id as keyof typeof SAMPLE_INVOICE_DATA];
      
      setCustomerType(invoiceData.customerType);
      setSelectedCustomer(invoiceData.selectedCustomer);
      setWalkInCustomerName(invoiceData.walkInCustomerName);
      setWalkInContactNumber(invoiceData.walkInContactNumber);
      setWalkInAddress(invoiceData.walkInAddress);
      setIssueDate(invoiceData.issueDate);
      setDueDate(invoiceData.dueDate);
      setDeliveryStatus(invoiceData.deliveryStatus);
      setInvoiceNumber(invoiceData.invoiceNumber);
      setReferenceNumber(invoiceData.referenceNumber);
      setSelectedCategory(invoiceData.selectedCategory);
      setMasterDiscount(invoiceData.masterDiscount);
      setStockType(invoiceData.stockType);
      setProducts(invoiceData.products);
      setPaymentDetails(invoiceData.paymentDetails);
    }
  }, [id]);

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
    const newProduct: ProductItem = {
      id: Date.now().toString(),
      product: '',
      shop: '',
      quantity: '1',
      rate: '0',
      discount: '0',
      tax: '0',
      description: '',
      price: '0',
    };
    setProducts(prev => {
      const newProducts = [...prev, newProduct];
      
      // Scroll to the new product after a short delay to ensure it's rendered
      setTimeout(() => {
        productsListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return newProducts;
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
    const newPayment: PaymentDetail = {
      id: Date.now().toString(),
      amount: '0',
      account: '',
      date: new Date().toLocaleDateString(),
      reference: '',
    };
    setPaymentDetails(prev => {
      const newPayments = [...prev, newPayment];
      
      // Scroll to the new payment after a short delay to ensure it's rendered
      setTimeout(() => {
        paymentsListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      return newPayments;
    });
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

  const handleUpdate = () => {
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

    if (products.some(p => !p.product.trim())) {
      Alert.alert('Error', 'Please fill in all product details');
      return;
    }

    // Update invoice logic here
    Alert.alert('Success', 'Invoice updated successfully!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
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

  // Memoized ProductItem component for better performance
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
      <View style={stylesLocal.productCard}>
        <View style={stylesLocal.productHeader}>
          <Text style={stylesLocal.productNumber}>Product #{index + 1}</Text>
          {canRemove && (
            <TouchableOpacity
              style={stylesLocal.removeButton}
              onPress={() => onRemove(product.id)}
              accessibilityLabel={`Remove product ${index + 1}`}
            >
              <MaterialIcons name="close" size={resp.fontSize(16)} color="#e74c3c" />
            </TouchableOpacity>
          )}
        </View>

        <View style={stylesLocal.productForm}>
          <View style={stylesLocal.formRow}>
            <Text style={stylesLocal.formLabel}>Product Name</Text>
            <TextInput
              style={stylesLocal.formInput}
              placeholder="Enter product name"
              placeholderTextColor={icon}
              value={product.product}
              onChangeText={(value) => onUpdate(product.id, 'product', value)}
            />
          </View>

          <View style={stylesLocal.formRow}>
            <Text style={stylesLocal.formLabel}>Shop</Text>
            <TouchableOpacity style={stylesLocal.formInput}>
              <Text style={[stylesLocal.inputText, { color: product.shop ? text : icon }]}>
                {product.shop || 'Select shop'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
            </TouchableOpacity>
          </View>

          <View style={stylesLocal.row}>
            <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
              <Text style={stylesLocal.formLabel}>Quantity</Text>
              <TextInput
                style={stylesLocal.formInput}
                placeholder="0"
                placeholderTextColor={icon}
                value={product.quantity}
                onChangeText={(value) => onUpdate(product.id, 'quantity', value)}
                keyboardType="numeric"
              />
            </View>

            <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
              <Text style={stylesLocal.formLabel}>Rate</Text>
              <TextInput
                style={stylesLocal.formInput}
                placeholder="0.00"
                placeholderTextColor={icon}
                value={product.rate}
                onChangeText={(value) => onUpdate(product.id, 'rate', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={stylesLocal.row}>
            <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
              <Text style={stylesLocal.formLabel}>Discount (%)</Text>
              <TextInput
                style={stylesLocal.formInput}
                placeholder="0"
                placeholderTextColor={icon}
                value={product.discount}
                onChangeText={(value) => onUpdate(product.id, 'discount', value)}
                keyboardType="numeric"
              />
            </View>

            <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
              <Text style={stylesLocal.formLabel}>Tax</Text>
              <TextInput
                style={stylesLocal.formInput}
                placeholder="0"
                placeholderTextColor={icon}
                value={product.tax}
                onChangeText={(value) => onUpdate(product.id, 'tax', value)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={stylesLocal.formRow}>
            <Text style={stylesLocal.formLabel}>Description</Text>
            <TextInput
              style={stylesLocal.formInput}
              placeholder="Enter product description"
              placeholderTextColor={icon}
              value={product.description}
              onChangeText={(value) => onUpdate(product.id, 'description', value)}
              multiline
            />
          </View>

          <View style={stylesLocal.priceRow}>
            <Text style={stylesLocal.priceLabel}>Total Price:</Text>
            <Text style={stylesLocal.priceValue}>{product.price} Rs.</Text>
          </View>
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
        onRemove={removeProduct}
        canRemove={products.length > 1}
      />
    );
  }, [updateProduct, removeProduct, products.length]);

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

  // Memoized PaymentItem component for better performance
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
      <View style={stylesLocal.paymentCard}>
        <View style={stylesLocal.productHeader}>
          <Text style={stylesLocal.productNumber}>Payment #{index + 1}</Text>
          {canRemove && (
            <TouchableOpacity
              style={stylesLocal.removeButton}
              onPress={() => onRemove(payment.id)}
              accessibilityLabel={`Remove payment ${index + 1}`}
            >
              <MaterialIcons name="close" size={resp.fontSize(16)} color="#e74c3c" />
            </TouchableOpacity>
          )}
        </View>

        <View style={stylesLocal.row}>
          <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
            <Text style={stylesLocal.formLabel}>Amount</Text>
            <TextInput
              style={stylesLocal.formInput}
              placeholder="0.00"
              placeholderTextColor={icon}
              value={payment.amount}
              onChangeText={(value) => onUpdate(payment.id, 'amount', value)}
              keyboardType="numeric"
            />
          </View>
          <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
            <Text style={stylesLocal.formLabel}>Account</Text>
            <TouchableOpacity 
              style={stylesLocal.formInput}
              onPress={() => onAccountSelect(index)}
            >
              <Text style={[stylesLocal.inputText, { color: payment.account ? text : icon }]}>
                {payment.account || 'Select account'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={stylesLocal.row}>
          <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
            <Text style={stylesLocal.formLabel}>Date</Text>
            <TextInput
              style={stylesLocal.formInput}
              placeholder="Date"
              placeholderTextColor={icon}
              value={payment.date}
              onChangeText={(value) => onUpdate(payment.id, 'date', value)}
            />
          </View>
          <View style={[stylesLocal.halfWidth, stylesLocal.formRow]}>
            <Text style={stylesLocal.formLabel}>Reference</Text>
            <TextInput
              style={stylesLocal.formInput}
              placeholder="Reference"
              placeholderTextColor={icon}
              value={payment.reference}
              onChangeText={(value) => onUpdate(payment.id, 'reference', value)}
            />
          </View>
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
        onUpdate={updatePayment}
        onRemove={removePayment}
        canRemove={paymentDetails.length > 1}
        onAccountSelect={(paymentIndex) => {
          setSelectedPaymentIndex(paymentIndex);
          setShowAccountModal(true);
        }}
      />
    );
  }, [updatePayment, removePayment, paymentDetails.length]);

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

  return (
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
                  />
                </View>
                <View style={stylesLocal.halfWidth}>
                  <TextInput
                    style={stylesLocal.textInput}
                    placeholder="Contact Number"
                    placeholderTextColor={icon}
                    value={walkInContactNumber}
                    onChangeText={setWalkInContactNumber}
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
            
            <View style={stylesLocal.row}>
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

            <View style={stylesLocal.row}>
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
                <TextInput
                  style={stylesLocal.textInput}
                  placeholder="Reference Number"
                  placeholderTextColor={icon}
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                />
              </View>
            </View>

            <View style={stylesLocal.row}>
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
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={[stylesLocal.inputText, { color: selectedCategory ? text : icon }]}>
                    {selectedCategory || 'Select Category'}
                  </Text>
                  <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={stylesLocal.row}>
              <View style={stylesLocal.halfWidth}>
                <TextInput
                  style={stylesLocal.textInput}
                  placeholder="Master Discount (%)"
                  placeholderTextColor={icon}
                  value={masterDiscount}
                  onChangeText={setMasterDiscount}
                  keyboardType="numeric"
                />
              </View>
              <View style={stylesLocal.halfWidth}>
                <View style={stylesLocal.radioGroup}>
                  <TouchableOpacity
                    style={stylesLocal.radioOption}
                    onPress={() => setStockType('send-now')}
                  >
                    <View style={[stylesLocal.radio, stockType === 'send-now' && stylesLocal.radioSelected]} />
                    <Text style={stylesLocal.radioText}>Send Now</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={stylesLocal.radioOption}
                    onPress={() => setStockType('multi-ship')}
                  >
                    <View style={[stylesLocal.radio, stockType === 'multi-ship' && stylesLocal.radioSelected]} />
                    <Text style={stylesLocal.radioText}>Multi Ship</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Products Section */}
          <View style={stylesLocal.section}>
            <View style={stylesLocal.sectionHeader}>
              <Text style={stylesLocal.sectionTitle}>Products</Text>
              <TouchableOpacity
                style={stylesLocal.addButton}
                onPress={addProduct}
              >
                <MaterialIcons name="add" size={resp.fontSize(16)} color="#ffffff" />
                <Text style={stylesLocal.addButtonText}>Add Product</Text>
              </TouchableOpacity>
            </View>

            <View style={stylesLocal.productsContainer}>
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

        {/* Bottom Actions */}
        <View style={stylesLocal.bottomActions}>
          <TouchableOpacity
            style={stylesLocal.cancelButton}
            onPress={handleCancel}
          >
            <Text style={stylesLocal.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={stylesLocal.createButton}
            onPress={handleUpdate}
          >
            <Text style={stylesLocal.createButtonText}>Update Invoice</Text>
          </TouchableOpacity>
        </View>

        {/* Modals */}
        <DropdownModal
          visible={showCustomerModal}
          title={customerType === 'dealers' ? 'Select Dealer' : 'Select Customer'}
          options={SAMPLE_CUSTOMERS}
          onClose={() => setShowCustomerModal(false)}
          onSelect={setSelectedCustomer}
        />

        <DropdownModal
          visible={showCategoryModal}
          title="Select Category"
          options={SAMPLE_CATEGORIES}
          onClose={() => setShowCategoryModal(false)}
          onSelect={setSelectedCategory}
        />

        <DropdownModal
          visible={showDeliveryModal}
          title="Select Delivery Status"
          options={['Pending', 'Processing', 'Shipped', 'Out for delivery', 'Delivered']}
          onClose={() => setShowDeliveryModal(false)}
          onSelect={setDeliveryStatus}
        />

        <DropdownModal
          visible={showAccountModal}
          title="Select Account"
          options={SAMPLE_ACCOUNTS}
          onClose={() => setShowAccountModal(false)}
          onSelect={(account) => {
            updatePayment(paymentDetails[selectedPaymentIndex].id, 'account', account);
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
      </ThemedView>
    </SafeAreaView>
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
  });