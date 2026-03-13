import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "./query-client";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  dominantProfile: string | null;
  selectedScoreSections?: string[];
  selectedMetricKeys?: string[];
  selectedScoreSectionsBySport?: Record<string, string[]>;
  selectedMetricKeysBySport?: Record<string, string[]>;
  sportsInterests: string | null;
  bio: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  googleLogin: (tokens: { idToken?: string; accessToken?: string }) => Promise<void>;
  localBypassLogin: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  googleLogin: async () => {},
  localBypassLogin: () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (e) {}
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { identifier, password });
    const data = await res.json();
    setUser(data);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, name, password });
    const data = await res.json();
    setUser(data);
  }, []);

  const googleLogin = useCallback(async (tokens: { idToken?: string; accessToken?: string }) => {
    const res = await apiRequest("POST", "/api/auth/google", tokens);
    const data = await res.json();
    setUser(data);
  }, []);

  const localBypassLogin = useCallback(() => {
    setUser({
      id: "local-bypass-user",
      email: "local.user@swingai.dev",
      name: "Local User",
      avatarUrl: null,
      phone: null,
      address: null,
      country: null,
      dominantProfile: null,
      sportsInterests: null,
      bio: null,
      role: "user",
    });
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("POST", "/api/auth/logout");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, googleLogin, localBypassLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
