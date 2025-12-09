import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// Hide this dynamic route from the bottom tab bar
export const options = {
    tabBarButton: () => null,
};

type Customer = {
    id: string;
    name: string;
    contact: string;
    email: string;
    openingBalance: string;
    balance: string;
};

const customers: Customer[] = [
    { id: '#CUST00001', name: 'Imran jenral store', contact: '+923007456340', email: 'Imran@gmail.com', openingBalance: '39,528.00 Rs.', balance: '162,006.00 Rs.' },
    { id: '#CUST00002', name: 'Abid 1 Super Store', contact: '+923066410520', email: 'abid@gmail.com', openingBalance: '0.00 Rs.', balance: '5,000.00 Rs.' },
    { id: '#CUST00003', name: 'Abid 2 Super Store', contact: '+923085886077', email: 'shahid@gmail.com', openingBalance: '0.00 Rs.', balance: '0.00 Rs.' },
    { id: '#CUST00004', name: 'Baba Riaz Kryana Store', contact: '+920000000000', email: 'baba@gmail.com', openingBalance: '0.00 Rs.', balance: '0.00 Rs.' },
    { id: '#CUST00005', name: 'Azhar Kryana Store', contact: '+923099403223', email: 'azhar@gmail.com', openingBalance: '4,736.00 Rs.', balance: '6,717.68 Rs.' },
    { id: '#CUST00006', name: 'Hasam Kryana Store', contact: '+923088660164', email: 'hasam@gmail.com', openingBalance: '0.00 Rs.', balance: '0.00 Rs.' },
];

export default function EditCustomer() {
    const params = useLocalSearchParams();
    const id = (params as any).id as string | undefined;
    const router = useRouter();

    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [openingBalance, setOpeningBalance] = useState('0');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [stateVal, setStateVal] = useState('');
    const [country, setCountry] = useState('');
    const [zip, setZip] = useState('');

    useEffect(() => {
        if (!id) return;
        const found = customers.find((c) => c.id === id || c.id.replace('#', '') === id);
        if (found) {
            setName(found.name);
            setContact(found.contact);
            setEmail(found.email);
            setOpeningBalance(found.openingBalance?.replace(/[^0-9.]/g, '') ?? '0');
        }
    }, [id]);

    const handleCancel = () => router.back();
    const handleSave = () => {
        const payload = { id, name, contact, email, taxNumber, openingBalance, address, city, state: stateVal, country, zip };
        console.log('Save customer:', payload);
        router.back();
    };

    return (
        <ThemedView style={styles.safe}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <ThemedText style={styles.backIcon}>‹</ThemedText>
                    </TouchableOpacity>

                    <ThemedText type="title" style={styles.headerTitle}>Edit Customer</ThemedText>

                    {/* spacer so title stays centered */}
                    <View style={styles.headerRightPlaceholder} />
                </View>

                <ThemedText style={styles.label}>Name</ThemedText>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter Name" placeholderTextColor="#9aa3a8" />

                <ThemedText style={styles.label}>Contact</ThemedText>
                <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="Enter Contact" keyboardType="phone-pad" placeholderTextColor="#9aa3a8" />

                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Enter email" keyboardType="email-address" placeholderTextColor="#9aa3a8" />

                <ThemedText style={styles.label}>Tax Number</ThemedText>
                <TextInput style={styles.input} value={taxNumber} onChangeText={setTaxNumber} placeholder="Enter Tax Number" placeholderTextColor="#9aa3a8" />

                <ThemedText style={styles.label}>Opening Balance</ThemedText>
                <TextInput style={styles.input} value={openingBalance} onChangeText={setOpeningBalance} placeholder="0" keyboardType="numeric" placeholderTextColor="#9aa3a8" />

                <ThemedText style={styles.section}>Billing Address</ThemedText>
                <TextInput style={[styles.input, styles.textarea]} value={address} onChangeText={setAddress} placeholder="Enter Address" multiline />

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
                    <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel">
                        <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save">
                        <ThemedText style={styles.saveText}>Save</ThemedText>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: Colors.light.background },
    container: { padding: 12, paddingBottom: 36 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    backBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    backIcon: { fontSize: 22, color: Colors.light.tint },
    headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.light.text },
    headerRightPlaceholder: { width: 36 },
    title: { fontSize: 18, marginBottom: 8 },
    label: { color: Colors.light.icon, marginTop: 8, marginBottom: 6, fontSize: 13 },
    input: { borderWidth: 1, borderColor: '#e6eef0', padding: 8, borderRadius: 8, backgroundColor: Colors.light.background, fontSize: 14, color: Colors.light.text },
    textarea: { minHeight: 72, textAlignVertical: 'top' },
    section: { marginTop: 12, fontSize: 15, marginBottom: 6, color: Colors.light.text },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    col: { flex: 1, marginRight: 8 },
    actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
    btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8, minWidth: 80, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#6b6f73' },
    saveBtn: { backgroundColor: Colors.light.tint },
    cancelText: { color: '#fff', fontWeight: '600' },
    saveText: { color: '#fff', fontWeight: '600' },
});
