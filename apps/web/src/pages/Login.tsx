import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Preencha o email e a palavra-passe.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível iniciar sessão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-logo">
          Estrategor <span>/ Operacional</span>
        </div>
        <p className="login-sub">Inicie sessão para continuar.</p>

        <label className="login-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="login-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />

        <label className="login-label" htmlFor="password">
          Palavra-passe
        </label>
        <input
          id="password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary login-btn" type="submit" disabled={submitting}>
          {submitting ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
