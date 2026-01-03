import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  sessionId: string | null;
  login: (sessionId: string, user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = "streams-session-id";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SESSION_KEY);
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function validateSession() {
      if (!sessionId) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { "x-session-id": sessionId },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      } finally {
        setIsLoading(false);
      }
    }

    validateSession();
  }, [sessionId]);

  const login = useCallback((newSessionId: string, userData: User) => {
    localStorage.setItem(SESSION_KEY, newSessionId);
    setSessionId(newSessionId);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "x-session-id": sessionId },
        });
      } catch {
      }
    }
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setUser(null);
  }, [sessionId]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionId, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function getSessionHeaders(): HeadersInit {
  const sessionId = localStorage.getItem(SESSION_KEY);
  return sessionId ? { "x-session-id": sessionId } : {};
}
