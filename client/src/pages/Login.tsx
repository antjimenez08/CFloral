import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/pedidos" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch {
      setError("Email o contraseña incorrectos");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50">
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-pink-700 text-center">CFloral</h1>
        <p className="text-sm text-gray-500 text-center">Administración de la floristería</p>
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-pink-600 text-white rounded-md py-2 font-medium hover:bg-pink-700 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
