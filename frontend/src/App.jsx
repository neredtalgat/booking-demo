import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Navbar from "./components/Navbar";
import LoginPage from "./components/LoginPage";
import RoomsPage from "./components/RoomsPage";
import RoomDetailsPage from "./components/RoomDetailsPage";
import MyBookingsPage from "./components/MyBookingsPage";
import AdminRoomsPage from "./components/AdminRoomsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ToastContainer from "./components/ToastContainer";
import { restoreSession } from "./store/authSlice";
import "./App.css";

export default function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.ui.theme);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return (
    <div className={`app app--${theme}`}>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route element={<ProtectedRoute requireAuth={false} />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedRoute requireAuth />}>
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/rooms/:id" element={<RoomDetailsPage />} />
            <Route path="/bookings" element={<MyBookingsPage />} />
          </Route>

          <Route element={<ProtectedRoute requireAuth roles={["admin"]} />}>
            <Route path="/admin/rooms" element={<AdminRoomsPage />} />
          </Route>

          <Route path="*" element={<Navigate to={user ? "/rooms" : "/login"} replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}
