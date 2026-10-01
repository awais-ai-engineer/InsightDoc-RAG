"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, User } from "@/lib/api";
import { tokenStore } from "@/lib/auth";

type AuthState = { user: User | null; token: string | null; loading: boolean; login: (token: string, user: User) => void; logout: () => void };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [token, setToken] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const router = useRouter(); const pathname = usePathname();
  useEffect(() => { const stored = tokenStore.get(); if (!stored) { setLoading(false); return; } setToken(stored); api<User>("/auth/me", {}, stored).then(setUser).catch(() => { tokenStore.clear(); setToken(null); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!loading && !user && !["/login", "/signup"].includes(pathname)) router.replace("/login"); }, [loading, user, pathname, router]);
  useEffect(() => { const unauthorized = () => { tokenStore.clear(); setToken(null); setUser(null); router.replace("/login"); }; window.addEventListener("insightdoc:unauthorized", unauthorized); return () => window.removeEventListener("insightdoc:unauthorized", unauthorized); }, [router]);
  const login = (nextToken: string, nextUser: User) => { tokenStore.set(nextToken); setToken(nextToken); setUser(nextUser); router.replace("/dashboard"); };
  const logout = () => { tokenStore.clear(); setToken(null); setUser(null); router.replace("/login"); };
  return <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider missing"); return value; }
