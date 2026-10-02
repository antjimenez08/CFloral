import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, AuthUser, PermissionKey, PermissionMatrix, Store } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  stores: Store[];
  currentStoreId: string | null;
  setCurrentStoreId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  can: (key: PermissionKey) => boolean;
  refreshUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("cfloral_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [permissions, setPermissions] = useState<PermissionMatrix | null>(() => {
    const raw = localStorage.getItem("cfloral_permissions");
    return raw ? JSON.parse(raw) : null;
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStoreId, setCurrentStoreIdState] = useState<string | null>(
    () => localStorage.getItem("cfloral_current_store")
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

  // Refresca usuario y permisos desde el servidor (no solo la foto que trajo el login), para que
  // un cambio de permisos hecho en Administración → Roles se refleje sin tener que cerrar sesión.
  useEffect(() => {
    if (!user) return;
    function refreshMe() {
      api
        .get<{ user: AuthUser; permissions: PermissionMatrix }>("/auth/me")
        .then((res) => {
          setUser(res.data.user);
          setPermissions(res.data.permissions);
          localStorage.setItem("cfloral_user", JSON.stringify(res.data.user));
          localStorage.setItem("cfloral_permissions", JSON.stringify(res.data.permissions));
        })
        .catch(() => {});
    }
    refreshMe();
    window.addEventListener("focus", refreshMe);
    return () => window.removeEventListener("focus", refreshMe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
      localStorage.setItem("cfloral_permissions", JSON.stringify(res.data.permissions));
      setUser(res.data.user);
      setPermissions(res.data.permissions);
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
    localStorage.removeItem("cfloral_permissions");
    localStorage.removeItem("cfloral_current_store");
    setUser(null);
    setPermissions(null);
    setStores([]);
    setCurrentStoreIdState(null);
  }

  function refreshUser(patch: Partial<AuthUser>) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem("cfloral_user", JSON.stringify(next));
      return next;
    });
  }

  /** Igual que can(key) del mockup: ADMIN siempre true, los demás consultan la matriz. */
  function can(key: PermissionKey): boolean {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    return !!permissions?.[key];
  }

  return (
    <AuthContext.Provider
      value={{ user, stores, currentStoreId, setCurrentStoreId, login, logout, loading, can, refreshUser }}
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
