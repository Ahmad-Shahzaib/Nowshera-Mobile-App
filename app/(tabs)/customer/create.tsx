import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSync } from '@/context/SyncContext';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// Hide this route from the bottom tab bar
export const options = {
  tabBarButton: () => null,
};

export default function CreateCustomer() {
  const router = useRouter();
  const { addCustomer } = useSync();

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

  const handleCancel = useCallback(() => router.back(), [router]);

  const handleCreate = useCallback(() => {
    (async () => {
      const payload = { name, contact, email, taxNumber, openingBalance, address, city, state: stateVal, country, zip };
      try {
        await addCustomer(payload);
      } catch (err) {
        console.warn('Failed to save customer locally', err);
      }
      router.back();
    })();
  }, [name, contact, email, taxNumber, openingBalance, address, city, stateVal, country, zip, router]);

  return (
    <ThemedView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton} accessibilityLabel="Back">
            <ThemedText style={styles.backText}>←</ThemedText>
          </TouchableOpacity>

          <ThemedText type="title" style={styles.title}>Add Customer</ThemedText>

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
          <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={handleCancel}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleCreate}>
            <ThemedText style={styles.saveText}>Create</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  container: { padding: 14, paddingBottom: 40 },
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
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8, minWidth: 88, alignItems: 'center' },
  cancelBtn: { backgroundColor: Colors.light.icon },
  saveBtn: { backgroundColor: Colors.light.tint },
  cancelText: { color: '#fff', fontWeight: '600' },
  saveText: { color: '#fff', fontWeight: '600' },
});
