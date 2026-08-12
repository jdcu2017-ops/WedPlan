"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { UserRole } from "@wedplan/shared";
import { ApiError, apiRequest } from "./api-client";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type LoginResult = { mfaRequired: true; mfaTicket: string } | { mfaRequired: false };

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // Exposed for the messaging WebSocket handshake — everything else should
  // go through authFetch rather than reading this directly.
  accessToken: string | null;
  signup: (email: string, password: string, role: "inquirer" | "vendor") => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeMfaLogin: (mfaTicket: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T>(path: string, options?: { method?: ApiMethod; body?: unknown }) => Promise<T>;
}

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const REFRESH_TOKEN_KEY = "wedplan.refreshToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (token: string): Promise<AuthUser> => {
    const result = await apiRequest<{ user: AuthUser }>("/users/me", { accessToken: token });
    return result.user;
  }, []);

  const establishSession = useCallback(
    async (tokens: TokenPair) => {
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      setAccessToken(tokens.accessToken);
      setUser(await fetchMe(tokens.accessToken));
    },
    [fetchMe],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
  }, []);

  // Rotating refresh: every call both consumes and replaces the stored
  // refresh token, matching the API's single-use rotation.
  const refresh = useCallback(async (): Promise<string> => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      throw new ApiError(401, "No session to refresh");
    }
    const tokens = await apiRequest<TokenPair>("/auth/refresh", {
      method: "POST",
      body: { refreshToken: storedRefreshToken },
    });
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    return tokens.accessToken;
  }, []);

  useEffect(() => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      setLoading(false);
      return;
    }
    refresh()
      .then((token) => fetchMe(token))
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setLoading(false));
    // Only ever run once on mount — refresh/fetchMe/clearSession are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signup = useCallback<AuthContextValue["signup"]>(async (email, password, role) => {
    await apiRequest("/auth/signup", { method: "POST", body: { email, password, role } });
  }, []);

  const login = useCallback<AuthContextValue["login"]>(
    async (email, password) => {
      const result = await apiRequest<TokenPair | { mfaRequired: true; mfaTicket: string }>(
        "/auth/login",
        { method: "POST", body: { email, password } },
      );
      if ("mfaRequired" in result) {
        return result;
      }
      await establishSession(result);
      return { mfaRequired: false };
    },
    [establishSession],
  );

  const completeMfaLogin = useCallback<AuthContextValue["completeMfaLogin"]>(
    async (mfaTicket, code) => {
      const tokens = await apiRequest<TokenPair>("/auth/login/mfa", {
        method: "POST",
        body: { mfaTicket, code },
      });
      await establishSession(tokens);
    },
    [establishSession],
  );

  const logout = useCallback<AuthContextValue["logout"]>(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: { refreshToken: storedRefreshToken },
      }).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  // Attaches the current access token and retries exactly once through a
  // fresh refresh if the API says it's expired. Deliberately not wrapped in
  // useCallback — a generic function's signature can get flattened when
  // passed through useCallback, and this is cheap enough to recreate freely.
  async function authFetch<T>(
    path: string,
    options?: { method?: ApiMethod; body?: unknown },
  ): Promise<T> {
    try {
      return await apiRequest<T>(path, { ...options, accessToken: accessToken ?? undefined });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const newToken = await refresh();
        return apiRequest<T>(path, { ...options, accessToken: newToken });
      }
      throw err;
    }
  }

  const value: AuthContextValue = {
    user,
    loading,
    accessToken,
    signup,
    login,
    completeMfaLogin,
    logout,
    authFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
