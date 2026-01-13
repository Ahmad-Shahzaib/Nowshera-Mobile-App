import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { customerService } from '../../services/customerService';
import { invoiceService } from '../../services/invoiceService';
import { categoryService, productService } from '../../services/productService';

export default function DashboardTab() {
  const [counts, setCounts] = useState({
    customers: 0,
    unsyncedCustomers: 0,
    invoices: 0,
    unsyncedInvoices: 0,
    products: 0,
    categories: 0,
  });
  const [loading, setLoading] = useState(true);


  const fetchCounts = async () => {
    setLoading(true);
    try {
      const [customerCount, unsyncedCustomers, invoicePage, products, categories] = await Promise.all([
        customerService.getAllCustomers().then(arr => arr.length),
        customerService.getUnsyncedCount(),
        invoiceService.getInvoices(1, 1),
        productService.getProductCount(),
        categoryService.getCategoryCount(),
      ]);
      let unsyncedInvoices = 0;
      if (invoiceService.getUnsyncedCount) {
        unsyncedInvoices = await invoiceService.getUnsyncedCount();
      }
      setCounts({
        customers: customerCount,
        unsyncedCustomers,
        invoices: invoicePage.total || 0,
        unsyncedInvoices,
        products,
        categories,
      });
    } catch (e) {
      // handle error
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchCounts}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {loading ? <Text>Loading...</Text> : (
        <View style={styles.cardsContainer}>
          <Card title="Customers" count={counts.customers} unsynced={counts.unsyncedCustomers} />
          <Card title="Invoices" count={counts.invoices} unsynced={counts.unsyncedInvoices} />
          <Card title="Products" count={counts.products} />
          <Card title="Categories" count={counts.categories} />
        </View>
      )}
    </ScrollView>
  );
}

type CardProps = {
  title: string;
  count: number;
  unsynced?: number;
};

function Card({ title, count, unsynced }: CardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardCount}>{count}</Text>
      {typeof unsynced === 'number' && <Text style={styles.cardUnsynced}>Unsynced: {unsynced}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  refreshBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  refreshText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardsContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  cardUnsynced: {
    fontSize: 14,
    color: '#FF9500',
    marginTop: 4,
  },
});
