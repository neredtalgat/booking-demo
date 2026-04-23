import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../store/authSlice";
import { addToast, toggleTheme } from "../store/uiSlice";

export default function Navbar() {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.ui.theme);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logoutUser(token));
    dispatch(addToast("Logged out successfully", "success"));
    navigate("/login");
  };

  return (
    <header className="nav">
      <Link className="nav-brand" to={user ? "/rooms" : "/login"}>
        Hotel Booking System
      </Link>
      <nav className="nav-links">
        {user && (
          <>
            <Link className={location.pathname.startsWith("/rooms") ? "active" : ""} to="/rooms">
              Rooms
            </Link>
            <Link className={location.pathname === "/bookings" ? "active" : ""} to="/bookings">
              My bookings
            </Link>
            {user.role === "admin" && (
              <Link className={location.pathname === "/admin/rooms" ? "active" : ""} to="/admin/rooms">
                Manage rooms
              </Link>
            )}
          </>
        )}
      </nav>
      <div className="nav-actions">
        <button type="button" onClick={() => dispatch(toggleTheme())}>Theme: {theme}</button>
        {user ? (
          <>
            <span className="user-email">{user.email} ({user.role})</span>
            <button type="button" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <span>Please login</span>
        )}
      </div>
    </header>
  );
}
