import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch, clearToken, setToken } from "./api";

interface MobileUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  user: MobileUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const { getToken } = await import("./api");
        const saved = await getToken();
        console.log("[Auth] restored token:", saved);
        if (saved) {
          setTokenState(saved);
          const profile = await apiFetch<MobileUser>("/api/mobile/profile");
          setUser(profile);
        }
      } catch {
        // Token expired or invalid — clear it
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const data = await apiFetch<{ token: string; user: MobileUser }>(
      "/api/auth/mobile",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );
    console.log("[Auth] login response:", data);
    await setToken(data.token);
    console.log("[Auth] token stored");
    setTokenState(data.token);
    setUser(data.user);
  }

  async function logout() {
    await clearToken();
    setTokenState(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
