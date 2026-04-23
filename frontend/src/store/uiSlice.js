import { createSlice } from "@reduxjs/toolkit";

const THEME_STORAGE_KEY = "hotel_theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "dark" || saved === "light" ? saved : "light";
}

const initialState = {
  theme: getInitialTheme(),
  toasts: []
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
    },
    addToast: {
      reducer(state, action) {
        state.toasts.push(action.payload);
      },
      prepare(message, type = "info") {
        return {
          payload: {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            type,
            message
          }
        };
      }
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    }
  }
});

export const { toggleTheme, addToast, removeToast } = uiSlice.actions;
export default uiSlice.reducer;
