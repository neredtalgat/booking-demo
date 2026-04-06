import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("guest@hotel.com");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login(email);
      navigate("/rooms");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card login-card">
      <h1>Sign in</h1>
      <p>Use any email to continue. Demo: guest@hotel.com</p>
      <form onSubmit={handleSubmit} className="form-stack">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        {error && <p className="error">{error}</p>}
        <button disabled={loading} type="submit">
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </section>
  );
}
