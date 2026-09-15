import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, AuthUser, Store } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  stores: Store[];
  currentStoreId: string | null;
  setCurrentStoreId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("cfloral_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStoreId, setCurrentStoreIdState] = useState<string | null>(
    () => localStorage.getItem("cfloral_current_store"),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<Store[]>("/stores").then((res) => {
      setStores(res.data);
      if (!currentStoreId && res.data.length > 0) {
        setCurrentStoreId(res.data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function setCurrentStoreId(id: string) {
    localStorage.setItem("cfloral_current_store", id);
    setCurrentStoreIdState(id);
  }

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("cfloral_token", res.data.token);
      localStorage.setItem("cfloral_user", JSON.stringify(res.data.user));
      setUser(res.data.user);
      if (res.data.user.storeId) {
        setCurrentStoreId(res.data.user.storeId);
      }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("cfloral_token");
    localStorage.removeItem("cfloral_user");
    localStorage.removeItem("cfloral_current_store");
    setUser(null);
    setStores([]);
    setCurrentStoreIdState(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, stores, currentStoreId, setCurrentStoreId, login, logout, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
