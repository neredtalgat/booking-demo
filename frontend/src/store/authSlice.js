import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getMe, login as loginRequest, logout as logoutRequest, register as registerRequest } from "../api/client";

const STORAGE_KEY = "hotel_auth";

const initialState = {
  user: null,
  token: "",
  loading: false,
  initialized: false
};

function saveAuth(token, user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

function clearAuthStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

export const restoreSession = createAsyncThunk("auth/restoreSession", async (_, { rejectWithValue }) => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { token: "", user: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch {
    clearAuthStorage();
    return { token: "", user: null };
  }

  if (!parsed?.token) {
    clearAuthStorage();
    return { token: "", user: null };
  }

  try {
    const me = await getMe(parsed.token);
    saveAuth(parsed.token, me);
    return { token: parsed.token, user: me };
  } catch (err) {
    clearAuthStorage();
    return rejectWithValue(err.message || "Session restore failed");
  }
});

export const loginUser = createAsyncThunk("auth/loginUser", async ({ email, password }, { rejectWithValue }) => {
  try {
    const data = await loginRequest(email, password);
    saveAuth(data.token, data.user);
    return data;
  } catch (err) {
    return rejectWithValue(err.message || "Login failed");
  }
});

export const registerUser = createAsyncThunk("auth/registerUser", async (payload, { rejectWithValue }) => {
  try {
    return await registerRequest(payload);
  } catch (err) {
    return rejectWithValue(err.message || "Registration failed");
  }
});

export const logoutUser = createAsyncThunk("auth/logoutUser", async (token) => {
  try {
    if (token) {
      await logoutRequest(token);
    }
  } finally {
    clearAuthStorage();
  }
  return true;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.loading = false;
        state.initialized = true;
        state.token = "";
        state.user = null;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state) => {
        state.loading = false;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(registerUser.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = "";
      });
  }
});

export default authSlice.reducer;