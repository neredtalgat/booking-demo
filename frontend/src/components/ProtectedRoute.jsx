import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ requireAuth = true, roles = [] }) {
  const { user, initialized } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!initialized) {
    return <p className="muted">Checking session...</p>;
  }

  if (!requireAuth) {
    if (user) {
      return <Navigate to="/rooms" replace />;
    }
    return <Outlet />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/rooms" replace />;
  }

  return <Outlet />;
}