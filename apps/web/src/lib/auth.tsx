import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { canManageUsers, hasPermission, type PermissionKey, type UserDTO } from "@estrategor/shared";
import { api } from "./api.js";

interface AuthState {
  user: UserDTO | null;
  loading: boolean;
  canManageUsers: boolean;
  /** O utilizador da sessão tem a permissão? (TRNSF-1056) */
  can: (key: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Recarrega o utilizador da sessão (ex.: depois de editar o próprio perfil). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .session()
      .then((r) => setUser("user" in r ? null : r))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const r = await api.session();
    setUser("user" in r ? null : r);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        canManageUsers: user ? canManageUsers(user.role) : false,
        can: (key) => (user ? hasPermission(user, key) : false),
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
