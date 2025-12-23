import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { customerService } from '@/services/customerService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

// Hide this dynamic route from the bottom tab bar
export const options = {
    tabBarButton: () => null,
};

interface JournalItem {
    id: number;
    journal_type: string;
    date: string;
    description?: string;
    debit_amount?: number;
    credit_amount?: number;
}

interface CustomerDetail {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    contact_person?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    tax_id?: string;
}

interface CustomerData {
    customer: CustomerDetail;
    account_balance?: {
        opening_balance?: number;
    };
    calculated_balance?: number;
    journal_items?: JournalItem[];
}

export default function CustomerDetail() {
    const params = useLocalSearchParams();
    const id = (params as any).id as string | undefined;
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CustomerData | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadCustomerData = async (showLoader = true) => {
        if (!id) return;
        try {
            if (showLoader) setLoading(true);
            setError(null);
            const customerId = parseInt(id, 10);
            const result = await customerService.getCustomerById(customerId);
            setData(result);
        } catch (err: any) {
            const message = err?.message || 'Failed to load customer details';
            setError(message);
            Alert.alert('Error', message);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomerData();
    }, [id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadCustomerData(false);
        setRefreshing(false);
    };

    const handleEdit = () => {
        if (!id) return;
        router.push({ pathname: '/(tabs)/customer/edit/[id]', params: { id } });
    };

    const formatCurrency = (amount?: number | null): string => {
        if (amount == null) return '0.00 Rs.';
        return `${Math.abs(amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rs.`;
    };

    const renderJournalItem = ({ item }: { item: JournalItem }) => {
        const isDebit = (item.debit_amount ?? 0) > 0;
        const amount = isDebit ? item.debit_amount : item.credit_amount;
        const color = isDebit ? '#d32f2f' : '#388e3c';
        const sign = isDebit ? '−' : '+';

        const dateObj = new Date(item.date);
        const formattedDate = dateObj.toLocaleDateString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

        return (
            <View style={styles.journalItem}>
                <View style={styles.journalLeft}>
                    <ThemedText style={styles.journalType}>{item.journal_type}</ThemedText>
                    <ThemedText style={styles.journalDate}>{formattedDate}</ThemedText>
                    {item.description && (
                        <ThemedText style={styles.journalDesc}>{item.description}</ThemedText>
                    )}
                </View>
                <View style={styles.journalRight}>
                    <ThemedText style={[styles.journalAmount, { color }]}>
                        {sign} {formatCurrency(amount)}
                    </ThemedText>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <ThemedView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ThemedText style={styles.backIcon}>‹</ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="title" style={styles.headerTitle}>Customer Details</ThemedText>
                    <View style={styles.headerRightPlaceholder} />
                </View>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.light.tint} />
                </View>
            </ThemedView>
        );
    }

    if (error) {
        return (
            <ThemedView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ThemedText style={styles.backIcon}>‹</ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="title" style={styles.headerTitle}>Customer Details</ThemedText>
                    <View style={styles.headerRightPlaceholder} />
                </View>
                <View style={styles.centerContainer}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                    <TouchableOpacity style={[styles.btn, styles.retryBtn]} onPress={handleRefresh}>
                        <ThemedText style={styles.retryText}>Retry</ThemedText>
                    </TouchableOpacity>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.safe}>
            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ThemedText style={styles.backIcon}>‹</ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="title" style={styles.headerTitle}>Customer Details</ThemedText>
                    <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
                        <ThemedText style={styles.editIcon}>✎</ThemedText>
                    </TouchableOpacity>
                </View>

                {/* Customer Information Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Customer Information</ThemedText>
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <ThemedText style={styles.infoLabel}>Name</ThemedText>
                            <ThemedText style={styles.infoValue}>{data?.customer?.name || 'N/A'}</ThemedText>
                        </View>
                        {data?.customer?.contact_person && (
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Contact Person</ThemedText>
                                <ThemedText style={styles.infoValue}>{data.customer.contact_person}</ThemedText>
                            </View>
                        )}
                        {data?.customer?.phone && (
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Phone</ThemedText>
                                <ThemedText style={styles.infoValue}>{data.customer.phone}</ThemedText>
                            </View>
                        )}
                        {data?.customer?.email && (
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Email</ThemedText>
                                <ThemedText style={styles.infoValue}>{data.customer.email}</ThemedText>
                            </View>
                        )}
                        {data?.customer?.tax_id && (
                            <View style={styles.infoRow}>
                                <ThemedText style={styles.infoLabel}>Tax ID</ThemedText>
                                <ThemedText style={styles.infoValue}>{data.customer.tax_id}</ThemedText>
                            </View>
                        )}
                    </View>
                </View>

                {/* Address Section */}
                {data?.customer?.address && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Address</ThemedText>
                        <View style={styles.infoCard}>
                            {data.customer.address && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabel}>Address</ThemedText>
                                    <ThemedText style={styles.infoValue}>{data.customer.address}</ThemedText>
                                </View>
                            )}
                            {(data.customer.city || data.customer.state || data.customer.country) && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabel}>Location</ThemedText>
                                    <ThemedText style={styles.infoValue}>
                                        {[data.customer.city, data.customer.state, data.customer.country]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </ThemedText>
                                </View>
                            )}
                            {data.customer.postal_code && (
                                <View style={styles.infoRow}>
                                    <ThemedText style={styles.infoLabel}>Postal Code</ThemedText>
                                    <ThemedText style={styles.infoValue}>{data.customer.postal_code}</ThemedText>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Balance Section */}
                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Account Balance</ThemedText>
                    <View style={styles.balanceCard}>
                        {data?.account_balance?.opening_balance != null && (
                            <View style={styles.balanceRow}>
                                <ThemedText style={styles.balanceLabel}>Opening Balance</ThemedText>
                                <ThemedText style={styles.balanceValue}>
                                    {formatCurrency(data.account_balance.opening_balance)}
                                </ThemedText>
                            </View>
                        )}
                        <View style={[styles.balanceRow, { borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 12, marginTop: 12 }]}>
                            <ThemedText style={[styles.balanceLabel, { fontWeight: '600' }]}>Current Balance</ThemedText>
                            <ThemedText
                                style={[
                                    styles.balanceValue,
                                    { fontWeight: '600', color: (data?.calculated_balance ?? 0) >= 0 ? '#388e3c' : '#d32f2f' },
                                ]}
                            >
                                {formatCurrency(data?.calculated_balance)}
                            </ThemedText>
                        </View>
                    </View>
                </View>

                {/* Transaction History Section */}
                {data?.journal_items && data.journal_items.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Transaction History</ThemedText>
                        <View style={styles.journalContainer}>
                            <FlatList
                                data={data.journal_items}
                                scrollEnabled={false}
                                renderItem={renderJournalItem}
                                keyExtractor={(item) => `${item.id}-${item.journal_type}`}
                            />
                        </View>
                    </View>
                )}

                {(!data?.journal_items || data.journal_items.length === 0) && (
                    <View style={styles.section}>
                        <ThemedText type="subtitle" style={styles.sectionTitle}>Transaction History</ThemedText>
                        <ThemedText style={styles.noDataText}>No transactions found</ThemedText>
                    </View>
                )}
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.light.background },
    container: { padding: 12, paddingBottom: 36 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    backBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 24, color: Colors.light.tint, fontWeight: 'bold' },
    editBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.tint + '20' },
    editIcon: { fontSize: 18, color: Colors.light.tint },
    headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.light.text, flex: 1, textAlign: 'center' },
    headerRightPlaceholder: { width: 36 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#d32f2f', fontSize: 14, marginBottom: 16, textAlign: 'center' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.light.text, marginBottom: 10 },
    infoCard: { backgroundColor: Colors.light.background, borderWidth: 1, borderColor: '#e6eef0', borderRadius: 8, padding: 12, overflow: 'hidden' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: 12, color: Colors.light.icon, fontWeight: '500', flex: 0.4 },
    infoValue: { fontSize: 13, color: Colors.light.text, fontWeight: '500', textAlign: 'right', flex: 0.6 },
    balanceCard: { backgroundColor: Colors.light.background, borderWidth: 1, borderColor: '#e6eef0', borderRadius: 8, padding: 12, overflow: 'hidden' },
    balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    balanceLabel: { fontSize: 13, color: Colors.light.text },
    balanceValue: { fontSize: 14, color: Colors.light.tint, fontWeight: '600' },
    journalContainer: { marginBottom: 0 },
    journalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    journalLeft: { flex: 1, marginRight: 12 },
    journalRight: { alignItems: 'flex-end' },
    journalType: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
    journalDate: { fontSize: 11, color: Colors.light.icon, marginTop: 2 },
    journalDesc: { fontSize: 11, color: Colors.light.icon, marginTop: 2 },
    journalAmount: { fontSize: 13, fontWeight: '600' },
    noDataText: { fontSize: 13, color: Colors.light.icon, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
    btn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    retryBtn: { backgroundColor: Colors.light.tint },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
