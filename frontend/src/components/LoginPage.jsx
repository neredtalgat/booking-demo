import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState("Student User");
  const [email, setEmail] = useState("guest@hotel.com");
  const [password, setPassword] = useState("12345guest");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();
  const { login, register, loading } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      if (isRegisterMode) {
        await register({ name, email, password });
        setMessage("Registration success. You can login now.");
        setIsRegisterMode(false);
        return;
      }

      await login(email, password);
      navigate("/rooms");
    } catch (err) {
      setError(err.message);
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
        {message && <p className="status">{message}</p>}

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
