import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";

const expoExtraBase = (Constants.expoConfig && (Constants.expoConfig.extra as any)?.NEXT_PUBLIC_BASE_URL)
    || ((Constants as any).manifest && ((Constants as any).manifest.extra as any)?.NEXT_PUBLIC_BASE_URL)
    || null;

const BASE_URL = process.env?.NEXT_PUBLIC_BASE_URL || expoExtraBase || null;

// Debug information to help diagnose cases where BASE_URL is unexpectedly null.
// This will show the different places we looked for the value at runtime.
try {
    // eslint-disable-next-line no-console
    console.log('[lib/axios] NEXT_PUBLIC_BASE_URL resolution:', {
        processEnv: process?.env?.NEXT_PUBLIC_BASE_URL ?? null,
        expoExtraBase: expoExtraBase ?? null,
        manifestExtra: (Constants as any).manifest?.extra?.NEXT_PUBLIC_BASE_URL ?? null,
        final: BASE_URL ?? null,
    });
} catch (e) {
    /* ignore logging errors */
}

if (!BASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('[lib/axios] WARNING: `NEXT_PUBLIC_BASE_URL` is not set. Requests will use a relative URL and may go to the Metro packager (localhost:8081).\n' +
        'Make sure you have set NEXT_PUBLIC_BASE_URL in your .env or Expo `extra` (app.json / app.config.js), and restart the bundler with cache cleared: `expo start -c`.');
}
export function getAxiosInstance() {
    if (!BASE_URL) {
        throw new Error('[lib/axios] NEXT_PUBLIC_BASE_URL is not set. Set `NEXT_PUBLIC_BASE_URL` in your environment or Expo `extra` (app.json / app.config.js), then restart the bundler with cache cleared: `expo start -c`.');
    }

    const instance = axios.create({
        baseURL: `${BASE_URL}/api`,
        timeout: 10000,
        headers: {
            "Content-Type": "application/json",
        },
    });

    instance.interceptors.request.use(
        async (config) => {
            try {
                const token = await AsyncStorage.getItem("token");
                if (token) {
                    // Ensure headers object exists (Axios may have undefined headers type)
                    if (!config.headers) {
                        // cast to any to satisfy Axios header typing in TS
                        config.headers = {} as any;
                    }
                    (config.headers as any).Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                // If storage read fails, proceed without token
            }
            return config;
        },
        (error) => Promise.reject(error),
    );

    instance.interceptors.response.use(
        (response) => response,
        (error) => Promise.reject(error),
    );

    return instance;
}
