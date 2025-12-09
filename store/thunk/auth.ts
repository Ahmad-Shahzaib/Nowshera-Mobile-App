import { getAxiosInstance } from "@/lib/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk } from "@reduxjs/toolkit";

interface LoginPayload {
  email: string;
  password: string;
}

export const login = createAsyncThunk(
  "auth/login",
    async (payload: LoginPayload, { rejectWithValue }) => {
    try {
      // Create axios instance at call time so we log the resolved BASE_URL
      const axiosInstance = getAxiosInstance();

      const response = await axiosInstance.post("/login", {
        email: payload.email,
        password: payload.password,
      });

      const data = response.data;

      if (!data?.is_success) {
        return rejectWithValue(data?.message || "Login failed");
      }

      const token = data?.data?.token;
      const userId = data?.data?.user;
      const settings = data?.data?.settings || null;

      if (token) {
        try {
          await AsyncStorage.setItem("token", token);
        } catch (e) {
          console.warn("Failed to save token to storage", e);
        }
      }

      return { token, userId, settings };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Login error";
      return rejectWithValue(message);
    }
  }
);
