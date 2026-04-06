import { createContext, useContext, useEffect, useState } from "react";
import { login as loginRequest, register as registerRequest } from "../api/client";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("hotel_auth");
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (parsed?.user && parsed?.token) {
        setUser(parsed.user);
        setToken(parsed.token);
      }
    } catch {
      localStorage.removeItem("hotel_auth");
    }
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await loginRequest(email, password);
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("hotel_auth", JSON.stringify(data));
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const data = await registerRequest(payload);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken("");
    localStorage.removeItem("hotel_auth");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
