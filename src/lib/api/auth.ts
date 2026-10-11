import type { User } from "../types";
import { ApiError, apiFetch, onSessionEnded, setAccessToken } from "./client";

export interface Session {
  user: User;
  token: string;
}

export const DEMO_CREDENTIALS = { email: "admin@doctortracker.com", password: "Admin@12345" };

const USER_KEY = "dt_user";

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

let cached: Session | null = null;

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/**
 * Signs in against the API.
 *
 * The backend answers with the tokens in the body *and* sets httpOnly cookies;
 * both are used, so the session survives a reload and works for cross-origin
 * requests.
 */
export async function login(email: string, password: string, remember = true): Promise<Session> {
  const result = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  const user: User = { ...result.user, avatarUrl: result.user.avatarUrl ?? undefined };
  cached = { user, token: result.accessToken };
  setAccessToken(remember ? result.accessToken : null);

  if (typeof window !== "undefined") {
    (remember ? window.localStorage : window.sessionStorage).setItem(
      USER_KEY,
      JSON.stringify(user),
    );
  }

  return cached;
}

/** Returns the cached session, or `null` when the user is signed out. */
export function getSession(): Session | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  const user = readStoredUser();
  if (!user) return null;
  cached = { user, token: "" };
  return cached;
}

/** Revalidates the cached profile against `GET /auth/me`. */
export async function refreshSessionUser(): Promise<Session | null> {
  try {
    const user = await apiFetch<User>("/auth/me");
    const withAvatar: User = { ...user, avatarUrl: user.avatarUrl ?? undefined };
    cached = { user: withAvatar, token: "" };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(withAvatar));
      window.sessionStorage.setItem(USER_KEY, JSON.stringify(withAvatar));
    }
    return cached;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The account was deleted or disabled while the tab was open.
      clearLocalSession();
      return null;
    }
    throw error;
  }
}

export const isAuthenticated = (): boolean => getSession() !== null;

/** Drops every trace of the session from memory and from storage. */
function clearLocalSession(): void {
  cached = null;
  setAccessToken(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_KEY);
    window.sessionStorage.removeItem(USER_KEY);
  }
}

/** Revokes the session server-side and clears the local state. */
export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // Signing out locally must succeed even when the API is unreachable.
  }
  clearLocalSession();
}

/**
 * Subscribes to unrecoverable sessions. A rejected refresh token means the stored
 * profile must go too, or `isAuthenticated()` keeps returning true and the private
 * shell renders with every query failing.
 */
export function onSessionExpired(listener: () => void): () => void {
  return onSessionEnded(() => {
    clearLocalSession();
    listener();
  });
}
