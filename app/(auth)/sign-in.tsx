import { Colors, Fonts } from '@/constants/theme';
import useResponsive from '@/hooks/useResponsive';
import { useDispatch } from '@/store/store';
import { login } from '@/store/thunk/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View
} from 'react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const colorScheme = useColorScheme() ?? 'light';
    const theme = Colors[colorScheme];
    const { fontSize, horizontalScale, vertical, width } = useResponsive();
    const router = useRouter();  

    const dispatch = useDispatch();

    const handleLogin = async () => {
        setError('');
        try {
            // dispatch login thunk; thunk persists token to AsyncStorage
            await dispatch(login({ email: email.trim(), password } as any)).unwrap();

            // mark signed-in in local storage for layout logic and then navigate
            try {
                await AsyncStorage.setItem('SIGNED_IN', 'true');
                setEmail('');
                setPassword('');

                // Navigate after the storage write completes. Small timeout avoids
                // potential race with RootLayout's navigation logic.
                setTimeout(() => {
                    router.replace('/(tabs)/customer');
                }, 50);
            } catch (e) {
                // If storage fails, still attempt navigation
                console.warn('Failed to persist SIGNED_IN flag', e);
                router.replace('/(tabs)/customer');
            }
        } catch (err: any) {
            const message = err || 'Invalid email or password';
            setError(message);
            console.log('Login failed:', message);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: theme.background,
                                shadowColor: theme.text,
                                width: width * 0.9,
                                padding: horizontalScale(24),
                            },
                        ]}
                    >
                        <Text style={[styles.title, { color: theme.text, fontSize: fontSize(30) }]}>
                            Welcome Back 👋
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.icon, fontSize: fontSize(15) }]}>
                            Please sign in to continue
                        </Text>

                        <View style={{ marginTop: vertical(8) }}>
                            <View style={{ marginBottom: vertical(18) }}>
                                <Text style={[styles.label, { color: theme.text, fontSize: fontSize(14) }]}>
                                    Email
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            borderColor: theme.icon,
                                            color: theme.text,
                                            fontSize: fontSize(15),
                                            paddingVertical: vertical(12),
                                            paddingHorizontal: horizontalScale(14),
                                        },
                                    ]}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="Enter your email"
                                    placeholderTextColor={theme.icon}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={{ marginBottom: vertical(18) }}>
                                <Text style={[styles.label, { color: theme.text, fontSize: fontSize(14) }]}>
                                    Password
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            borderColor: theme.icon,
                                            color: theme.text,
                                            fontSize: fontSize(15),
                                            paddingVertical: vertical(12),
                                            paddingHorizontal: horizontalScale(14),
                                        },
                                    ]}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor={theme.icon}
                                    secureTextEntry
                                />
                            </View>

                            {error ? (
                                <Text style={{ color: '#e03e3e', textAlign: 'center', marginBottom: vertical(12) }}>
                                    {error}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                style={[
                                    styles.loginButton,
                                    { backgroundColor: theme.tint, paddingVertical: vertical(14) },
                                ]}
                                onPress={handleLogin}
                            >
                                <Text
                                    style={[
                                        styles.loginButtonText,
                                        {
                                            color: theme.background,
                                            fontSize: fontSize(16),
                                            fontFamily: Fonts.sans,
                                        },
                                    ]}
                                >
                                    Sign In
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderRadius: 24,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    title: {
        fontWeight: '700',
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 28,
        marginTop: 8,
    },
    label: {
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
    },
    loginButton: {
        borderRadius: 12,
        alignItems: 'center',
    },
    loginButtonText: {
        fontWeight: '600',
    },
});
