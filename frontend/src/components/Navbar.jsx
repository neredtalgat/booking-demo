import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="nav">
      <div className="nav-brand">Hotel Booking System</div>
      <nav className="nav-links">
        {user && (
          <>
            <Link className={location.pathname === "/rooms" ? "active" : ""} to="/rooms">
              Rooms
            </Link>
            <Link className={location.pathname === "/bookings" ? "active" : ""} to="/bookings">
              My bookings
            </Link>
          </>
        )}
      </nav>
      <div className="nav-actions">
        <button type="button" onClick={toggleTheme}>Theme: {theme}</button>
        {user ? (
          <>
            <span className="user-email">{user.email}</span>
            <button type="button" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <span>Please login</span>
        )}
      </div>
    </header>
  );
}
