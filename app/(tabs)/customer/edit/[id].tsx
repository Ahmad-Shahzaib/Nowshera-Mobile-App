import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { customerService } from '@/services/customerService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// Hide this route from the bottom tab bar
export const options = {
    tabBarButton: () => null,
};

export default function EditCustomer() {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [openingBalanceType, setOpeningBalanceType] = useState<'Dr' | 'Cr'>('Dr');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateVal, setStateVal] = useState('');
    const [country, setCountry] = useState('');
    const [zip, setZip] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch customer data on mount
    useEffect(() => {
        const fetchCustomer = async () => {
            try {
                setLoading(true);
                const customerId = parseInt(id as string);
                const data = await customerService.getCustomerById(customerId);

                // Extract customer and account_balance from nested response
                const customer = data.customer;
                const accountBalance = data.account_balance;

                // Prefill form with customer data
                setName(customer.name || '');
                setContact(customer.contact || '');
                setEmail(customer.email || '');
                setTaxNumber(customer.tax_number || '');
                setOpeningBalance(accountBalance.opening_balance || '0');
                setOpeningBalanceType(accountBalance.opening_balance_type || 'Dr');
                setAddress(customer.billing_address || '');
                setCity(customer.billing_city || '');
                setStateVal(customer.billing_state || '');
                setCountry(customer.billing_country || '');
                setZip(customer.billing_zip || '');
            } catch (err: any) {
                console.error('Failed to fetch customer:', err);
                Alert.alert('Error', err.message || 'Failed to load customer data', [
                    { text: 'Go Back', onPress: () => router.back() }
                ]);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchCustomer();
        }
    }, [id, router]);

    const handleCancel = useCallback(() => router.back(), [router]);

    const handleUpdate = useCallback(async () => {
        // Basic validation
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Name is required');
            return;
        }

        if (!contact.trim()) {
            Alert.alert('Validation Error', 'Contact is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const customerId = parseInt(id as string);

            // Prepare the payload according to the API structure
            const payload = {
                name: name.trim(),
                contact: contact.trim(),
                email: email.trim(),
                tax_number: taxNumber.trim() || null,
                balance: openingBalance.trim() || '0',
                opening_balance_type: openingBalanceType,
                created_by: 1,
                warehouse_id: 1,

                billing_name: name.trim(),
                billing_country: country.trim() || 'Pakistan',
                billing_state: stateVal.trim() || null,
                billing_city: city.trim(),
                billing_phone: contact.trim(),
                billing_zip: zip.trim() || null,
                billing_address: address.trim(),

                shipping_name: name.trim(),
                shipping_country: country.trim() || 'Pakistan',
                shipping_state: stateVal.trim() || null,
                shipping_city: city.trim(),
                shipping_phone: contact.trim(),
                shipping_zip: zip.trim() || null,
                shipping_address: address.trim(),

                type: 'Customer',
                lang: 'en',
            };

            // Call the API to update customer
            await customerService.updateCustomer(customerId, payload);

            Alert.alert('Success', 'Customer updated successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (err: any) {
            console.error('Failed to update customer:', err);
            Alert.alert('Error', err.message || 'Failed to update customer. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [id, name, contact, email, taxNumber, openingBalance, openingBalanceType, address, city, stateVal, country, zip, router]);

    if (loading) {
        return (
            <ThemedView style={styles.safe}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.light.tint} />
                    <ThemedText style={styles.loadingText}>Loading customer data...</ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

                <View style={styles.header}>
                    <TouchableOpacity onPress={handleCancel} style={styles.backButton} accessibilityLabel="Back">
                        <ThemedText style={styles.backText}>←</ThemedText>
                    </TouchableOpacity>

                    <ThemedText type="title" style={styles.title}>Edit Customer</ThemedText>

                    <View style={styles.headerRight} />
                </View>

                <ThemedText style={styles.label}>Name</ThemedText>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter name"
                    placeholderTextColor={Colors.light.icon}
                    autoCapitalize="words"
                    returnKeyType="next"
                />

                <ThemedText style={styles.label}>Contact</ThemedText>
                <TextInput
                    style={styles.input}
                    value={contact}
                    onChangeText={setContact}
                    placeholder="Enter contact"
                    placeholderTextColor={Colors.light.icon}
                    keyboardType="phone-pad"
                />

                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email"
                    placeholderTextColor={Colors.light.icon}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <ThemedText style={styles.label}>Tax Number</ThemedText>
                <TextInput
                    style={styles.input}
                    value={taxNumber}
                    onChangeText={setTaxNumber}
                    placeholder="Enter tax number"
                    placeholderTextColor={Colors.light.icon}
                />

                <ThemedText style={styles.label}>Opening Balance</ThemedText>
                <TextInput
                    style={styles.input}
                    value={openingBalance}
                    onChangeText={setOpeningBalance}
                    placeholder="0"
                    placeholderTextColor={Colors.light.icon}
                    keyboardType="numeric"
                />

                <ThemedText style={styles.label}>Balance Type</ThemedText>
                <View style={styles.radioGroup}>
                    <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => setOpeningBalanceType('Dr')}
                        accessibilityLabel="Select Debit"
                    >
                        <View style={[styles.radioCircle, openingBalanceType === 'Dr' && styles.radioCircleSelected]}>
                            {openingBalanceType === 'Dr' && <View style={styles.radioCircleInner} />}
                        </View>
                        <ThemedText style={styles.radioLabel}>Dr</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => setOpeningBalanceType('Cr')}
                        accessibilityLabel="Select Credit"
                    >
                        <View style={[styles.radioCircle, openingBalanceType === 'Cr' && styles.radioCircleSelected]}>
                            {openingBalanceType === 'Cr' && <View style={styles.radioCircleInner} />}
                        </View>
                        <ThemedText style={styles.radioLabel}>Cr</ThemedText>
                    </TouchableOpacity>
                </View>

                <ThemedText style={styles.section}>Billing Address</ThemedText>
                <TextInput
                    style={[styles.input, styles.textarea]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Enter address"
                    placeholderTextColor={Colors.light.icon}
                    multiline
                />

                <View style={styles.row}>
                    <View style={styles.col}>
                        <ThemedText style={styles.label}>City</ThemedText>
                        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Enter City" />
                    </View>
                    <View style={styles.col}>
                        <ThemedText style={styles.label}>State</ThemedText>
                        <TextInput style={styles.input} value={stateVal} onChangeText={setStateVal} placeholder="Enter State" />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={styles.col}>
                        <ThemedText style={styles.label}>Country</ThemedText>
                        <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Enter Country" />
                    </View>
                    <View style={styles.col}>
                        <ThemedText style={styles.label}>Zip Code</ThemedText>
                        <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="Enter Zip Code" />
                    </View>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancel} disabled={isSubmitting}>
                        <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btn, styles.saveBtn, isSubmitting && styles.disabledBtn]}
                        onPress={handleUpdate}
                        disabled={isSubmitting}
                    >
                        <ThemedText style={styles.saveText}>
                            {isSubmitting ? 'Updating...' : 'Update'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.light.background },
    container: { padding: 14, paddingBottom: 40 },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        color: '#6b6f73',
        fontSize: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    backButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    backText: { fontSize: 20, color: Colors.light.tint },
    headerRight: { width: 36 },
    title: { fontSize: 18, textAlign: 'center' },
    label: { color: Colors.light.icon, marginTop: 8, marginBottom: 6, fontSize: 13 },
    input: {
        borderWidth: 1,
        borderColor: '#e6eef0',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
        fontSize: 14,
    },
    textarea: { minHeight: 76, textAlignVertical: 'top' },
    section: { marginTop: 12, fontSize: 15, marginBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    col: { flex: 1, marginRight: 8 },
    actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
    radioGroup: { flexDirection: 'row', marginTop: 4, marginBottom: 8 },
    radioOption: { flexDirection: 'row', alignItems: 'center', marginRight: 24 },
    radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.light.icon, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    radioCircleSelected: { borderColor: Colors.light.tint },
    radioCircleInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.light.tint },
    radioLabel: { fontSize: 14, color: Colors.light.text },
    btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8, minWidth: 88, alignItems: 'center' },
    cancelBtn: { backgroundColor: Colors.light.icon },
    saveBtn: { backgroundColor: Colors.light.tint },
    disabledBtn: { backgroundColor: Colors.light.icon, opacity: 0.6 },
    cancelText: { color: '#fff', fontWeight: '600' },
    saveText: { color: '#fff', fontWeight: '600' },
});
