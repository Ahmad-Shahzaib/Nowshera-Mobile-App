import { login } from "@/store/thunk/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  userId: number | null;
  settings?: Record<string, any> | null;
  isLoading: boolean;
  error: string | null;
}

const defaultState: AuthState = {
  token: null,
  userId: null,
  settings: null,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState: defaultState,
  reducers: {
    logout(state) {
      state.token = null;
      state.userId = null;
      state.settings = null;
      state.error = null;
      try {
        AsyncStorage.removeItem("token");
      } catch {
        /* ignore */
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{ token: string; userId: number; settings?: Record<string, any> }>) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.userId = action.payload.userId ?? null;
        state.settings = action.payload.settings ?? null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || action.error.message || "Login failed";
      });
  },
});

export const { logout } = authSlice.actions;

export default authSlice.reducer;
