import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import LoginPage from "./components/LoginPage";
import RoomsPage from "./components/RoomsPage";
import MyBookingsPage from "./components/MyBookingsPage";
import AdminRoomsPage from "./components/AdminRoomsPage";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import "./App.css";

export default function App() {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div className={`app app--${theme}`}>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/rooms" element={user ? <RoomsPage /> : <Navigate to="/login" replace />} />
          <Route path="/bookings" element={user ? <MyBookingsPage /> : <Navigate to="/login" replace />} />
          <Route
            path="/admin/rooms"
            element={user?.role === "admin" ? <AdminRoomsPage /> : <Navigate to="/rooms" replace />}
          />
          <Route path="*" element={<Navigate to={user ? "/rooms" : "/login"} replace />} />
        </Routes>
      </main>
    </div>
  );
}
