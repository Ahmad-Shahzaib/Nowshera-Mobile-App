import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import useResponsive from '@/hooks/useResponsive';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
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

export default function CreateInvoice() {
  const resp = useResponsive();
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const icon = useThemeColor({}, 'icon');
  const router = useRouter();

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
  const [invoiceNumber, setInvoiceNumber] = useState('#INVO00013');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [masterDiscount, setMasterDiscount] = useState('');
  const [stockType, setStockType] = useState<'send-now' | 'multi-ship'>('send-now');

  // Products
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: '1',
      product: 'مولٹی فوم',
      shop: '',
      quantity: '1',
      rate: '423.00',
      discount: '100.00 %',
      tax: '0',
      description: 'فوم کی اقسام اور فوم کمپنی',
      price: '1,692.00',
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

  const handleCreate = () => {
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

    // Create invoice logic here
    Alert.alert('Success', 'Invoice created successfully!', [
      { text: 'OK', onPress: () => router.back() }
    ]);
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
          <Text style={stylesLocal.productNumber}>#{index + 1}</Text>
          {canRemove && (
            <TouchableOpacity 
              onPress={() => onRemove(product.id)}
              style={stylesLocal.removeButton}
            >
              <MaterialIcons name="close" size={resp.fontSize(16)} color="#ff4d6d" />
            </TouchableOpacity>
          )}
        </View>

        <View style={stylesLocal.productForm}>
          {/* Product Name */}
          <View style={stylesLocal.formRow}>
            <ThemedText style={stylesLocal.formLabel}>Product</ThemedText>
            <TextInput
              style={stylesLocal.formInput}
              value={product.product}
              onChangeText={(value) => onUpdate(product.id, 'product', value)}
              placeholder="Enter product name"
              placeholderTextColor={icon}
            />
          </View>

          {/* Shop */}
          <View style={stylesLocal.formRow}>
            <ThemedText style={stylesLocal.formLabel}>Shop</ThemedText>
            <TextInput
              style={stylesLocal.formInput}
              value={product.shop}
              onChangeText={(value) => onUpdate(product.id, 'shop', value)}
              placeholder="Enter shop name"
              placeholderTextColor={icon}
            />
          </View>

          {/* Quantity and Rate */}
          <View style={stylesLocal.row}>
            <View style={stylesLocal.halfWidth}>
              <ThemedText style={stylesLocal.formLabel}>Quantity</ThemedText>
              <TextInput
                style={stylesLocal.formInput}
                value={product.quantity}
                onChangeText={(value) => onUpdate(product.id, 'quantity', value)}
                placeholder="1"
                placeholderTextColor={icon}
                keyboardType="numeric"
              />
            </View>
            <View style={stylesLocal.halfWidth}>
              <ThemedText style={stylesLocal.formLabel}>Rate</ThemedText>
              <TextInput
                style={stylesLocal.formInput}
                value={product.rate}
                onChangeText={(value) => onUpdate(product.id, 'rate', value)}
                placeholder="0.00"
                placeholderTextColor={icon}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Discount and Tax */}
          <View style={stylesLocal.row}>
            <View style={stylesLocal.halfWidth}>
              <ThemedText style={stylesLocal.formLabel}>Discount %</ThemedText>
              <TextInput
                style={stylesLocal.formInput}
                value={product.discount}
                onChangeText={(value) => onUpdate(product.id, 'discount', value)}
                placeholder="0"
                placeholderTextColor={icon}
                keyboardType="numeric"
              />
            </View>
            <View style={stylesLocal.halfWidth}>
              <ThemedText style={stylesLocal.formLabel}>Tax %</ThemedText>
              <TextInput
                style={stylesLocal.formInput}
                value={product.tax}
                onChangeText={(value) => onUpdate(product.id, 'tax', value)}
                placeholder="0"
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
                height: resp.vertical(72),
                paddingTop: resp.vertical(16),
                textAlignVertical: 'top'
              }]}
              value={product.description}
              onChangeText={(value) => onUpdate(product.id, 'description', value)}
              placeholder="Enter description"
              placeholderTextColor={icon}
              multiline
            />
          </View>

          {/* Price Display */}
          <View style={stylesLocal.priceRow}>
            <ThemedText style={stylesLocal.priceLabel}>Amount:</ThemedText>
            <ThemedText style={stylesLocal.priceValue}>{product.price} Rs.</ThemedText>
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
              onPress={() => onRemove(payment.id)}
              style={stylesLocal.removeButton}
            >
              <MaterialIcons name="close" size={resp.fontSize(16)} color="#ff4d6d" />
            </TouchableOpacity>
          )}
        </View>

        <View style={stylesLocal.row}>
          <View style={stylesLocal.halfWidth}>
            <ThemedText style={stylesLocal.formLabel}>Amount</ThemedText>
            <TextInput
              style={stylesLocal.formInput}
              value={payment.amount}
              onChangeText={(value) => onUpdate(payment.id, 'amount', value)}
              placeholder="0"
              placeholderTextColor={icon}
              keyboardType="numeric"
            />
          </View>
          <View style={stylesLocal.halfWidth}>
            <ThemedText style={stylesLocal.formLabel}>Account</ThemedText>
            <TouchableOpacity 
              style={stylesLocal.input}
              onPress={() => onAccountSelect(index)}
            >
              <Text style={[stylesLocal.inputText, { color: payment.account ? text : icon }]}>
                {payment.account || 'Select Account'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={stylesLocal.row}>
          <View style={stylesLocal.halfWidth}>
            <ThemedText style={stylesLocal.formLabel}>Date</ThemedText>
            <TextInput
              style={stylesLocal.formInput}
              value={payment.date}
              onChangeText={(value) => onUpdate(payment.id, 'date', value)}
              placeholder="11/05/2025"
              placeholderTextColor={icon}
            />
          </View>
          <View style={stylesLocal.halfWidth}>
            <ThemedText style={stylesLocal.formLabel}>Reference</ThemedText>
            <TextInput
              style={stylesLocal.formInput}
              value={payment.reference}
              onChangeText={(value) => onUpdate(payment.id, 'reference', value)}
              placeholder="Enter Reference"
              placeholderTextColor={icon}
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

  return (
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
                  {selectedCustomer || 'Select Customer'}
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
                  {selectedCustomer || 'Select Dealer'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={resp.fontSize(20)} color={icon} />
              </TouchableOpacity>
            </View>
          )}

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
                    {selectedCategory || 'Select Category'}
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
                  Invoice Number
                </ThemedText>
                <TextInput
                  style={stylesLocal.textInput}
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  placeholder="#INVO00013"
                  placeholderTextColor={icon}
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

          {/* Master Discount and Stock Type */}
          <View style={stylesLocal.section}>
            <View style={stylesLocal.row}>
              <View style={stylesLocal.halfWidth}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Master Discount
                </ThemedText>
                <TextInput
                  style={stylesLocal.textInput}
                  value={masterDiscount}
                  onChangeText={setMasterDiscount}
                  placeholder="Enter Master Discount"
                  placeholderTextColor={icon}
                  keyboardType="numeric"
                />
              </View>
              <View style={stylesLocal.halfWidth}>
                <ThemedText type="defaultSemiBold" style={stylesLocal.sectionTitle}>
                  Stock Type
                </ThemedText>
                <View style={stylesLocal.radioGroup}>
                  <TouchableOpacity 
                    style={stylesLocal.radioOption}
                    onPress={() => setStockType('send-now')}
                  >
                    <View style={[
                      stylesLocal.radio, 
                      stockType === 'send-now' && stylesLocal.radioSelected
                    ]}>
                      {stockType === 'send-now' && (
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
                    <Text style={stylesLocal.radioText}>Send Now Stock</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={stylesLocal.radioOption}
                    onPress={() => setStockType('multi-ship')}
                  >
                    <View style={[
                      stylesLocal.radio, 
                      stockType === 'multi-ship' && stylesLocal.radioSelected
                    ]}>
                      {stockType === 'multi-ship' && (
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
                    <Text style={stylesLocal.radioText}>Multi Ship Stock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Products & Services - Fixed Header Outside FlatList */}
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
            
            {/* Scrollable Products List */}
            <View style={stylesLocal.productsContainer}>
              <FlatList
                ref={productsListRef}
                data={products}
                renderItem={renderProductItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={ListHeaderComponent}
                ListFooterComponent={ListFooterComponent}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={false}
                maxToRenderPerBatch={3}
                windowSize={5}
                initialNumToRender={2}
                updateCellsBatchingPeriod={50}
                style={{ 
                  flexGrow: 0,
                  maxHeight: resp.vertical(600), // Increased height for better visibility
                  minHeight: resp.vertical(200), // Minimum height to ensure scrolling works
                  marginBottom: resp.vertical(16)
                }}
                contentContainerStyle={{ 
                  paddingBottom: resp.vertical(16),
                  flexGrow: 1
                }}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                scrollEnabled={true}
              />
            </View>
          </View>

          {/* Add Payment - Fixed Header Outside FlatList */}
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
            
            {/* Scrollable Payments List */}
            <View style={stylesLocal.productsContainer}>
              <FlatList
                ref={paymentsListRef}
                data={paymentDetails}
                renderItem={renderPaymentItem}
                keyExtractor={paymentKeyExtractor}
                ListHeaderComponent={PaymentListHeaderComponent}
                ListFooterComponent={PaymentListFooterComponent}
                showsVerticalScrollIndicator={true}
                removeClippedSubviews={false}
                maxToRenderPerBatch={3}
                windowSize={5}
                initialNumToRender={2}
                updateCellsBatchingPeriod={50}
                style={{ 
                  flexGrow: 0,
                  maxHeight: resp.vertical(500), // Increased height for better visibility
                  minHeight: resp.vertical(150), // Minimum height to ensure scrolling works
                  marginBottom: resp.vertical(16)
                }}
                contentContainerStyle={{ 
                  paddingBottom: resp.vertical(16),
                  flexGrow: 1
                }}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                scrollEnabled={true}
              />
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
            const updatedPayments = [...paymentDetails];
            updatedPayments[selectedPaymentIndex].account = account;
            setPaymentDetails(updatedPayments);
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