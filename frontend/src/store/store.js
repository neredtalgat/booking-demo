import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import uiReducer from "./uiSlice";

const THEME_STORAGE_KEY = "hotel_theme";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer
  }
});

let currentTheme = store.getState().ui.theme;

store.subscribe(() => {
  const nextTheme = store.getState().ui.theme;

  if (nextTheme !== currentTheme) {
    currentTheme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }
});
