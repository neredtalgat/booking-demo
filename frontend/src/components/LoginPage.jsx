import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, registerUser } from "../store/authSlice";
import { addToast } from "../store/uiSlice";

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState("Student User");
  const [email, setEmail] = useState("guest@hotel.com");
  const [password, setPassword] = useState("12345guest");
  const [error, setError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading } = useSelector((state) => state.auth);
  const destination = location.state?.from?.pathname || "/rooms";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (isRegisterMode) {
        await dispatch(registerUser({ name, email, password })).unwrap();
        dispatch(addToast("Registration successful. Please sign in.", "success"));
        setIsRegisterMode(false);
        return;
      }

      await dispatch(loginUser({ email, password })).unwrap();
      dispatch(addToast("Login successful", "success"));
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
      dispatch(addToast(err.message, "error"));
    }
  };

  return (
    <section className="card login-card">
      <h1>{isRegisterMode ? "Create account" : "Sign in"}</h1>
      <p>Demo users: admin@hotel.com/12345admin, guest@hotel.com/12345guest</p>

      <form onSubmit={handleSubmit} className="form-stack">
        {isRegisterMode && (
          <>
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />

        {error && <p className="error">{error}</p>}
        <button disabled={loading} type="submit">
          {loading ? "Please wait..." : isRegisterMode ? "Register" : "Login"}
        </button>
      </form>

      <button className="btn-text" type="button" onClick={() => setIsRegisterMode((prev) => !prev)}>
        {isRegisterMode ? "Already have account? Login" : "No account? Register"}
      </button>
    </section>
  );
}
