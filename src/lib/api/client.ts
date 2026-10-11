import type { Paginated } from "../types";

const LOCAL_DEV_API_URL = "http://localhost:4000/api/v1";
const TOKEN_KEY = "dt_access_token";

/** `window` is untyped; a deployment can pin the API URL at runtime (see README). */
declare global {
  interface Window {
    __DOCTOR_TRACKER_API_URL__?: string;
  }
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Resolves the API base URL: a runtime `window.__DOCTOR_TRACKER_API_URL__` override,
 * then the build-time `VITE_API_URL`, then the local development default.
 *
 * Falling back to the default on a non-local host means the bundle was built without
 * `VITE_API_URL`; {@link assertApiConfigured} turns that into a readable message.
 */
function resolveApiUrl(): { url: string; configured: boolean } {
  const runtime = typeof window !== "undefined" ? window.__DOCTOR_TRACKER_API_URL__ : undefined;
  const buildTime = import.meta.env["VITE_API_URL"];
  const explicit = runtime ?? buildTime;

  if (explicit && explicit.trim() !== "") {
    return { url: explicit.trim().replace(/\/+$/, ""), configured: true };
  }

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  return { url: LOCAL_DEV_API_URL, configured: isLocalHost(host) };
}

const resolved = resolveApiUrl();

export const API_URL = resolved.url;

/**
 * Throws a readable error when a production bundle points at `localhost`, which
 * happens whenever `VITE_API_URL` is missing from the build environment.
 */
function assertApiConfigured(): void {
  if (resolved.configured) return;
  throw new ApiError(
    "The API address is not configured for this deployment. Set VITE_API_URL to your " +
      `backend URL (for example https://api.example.com/api/v1) and redeploy. ` +
      `Currently the app is calling ${API_URL}, which only resolves on the machine running the API.`,
  );
}

/** Turns a browser-level fetch rejection into an actionable message. */
function toNetworkError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const target = API_URL.startsWith(LOCAL_DEV_API_URL)
    ? "local API on port 4000"
    : `API at ${API_URL}`;
  return new ApiError(
    `Could not reach the ${target}. Check that the API is running and that its CORS ` +
      `settings allow this site (${typeof window !== "undefined" ? window.location.origin : "unknown"}).`,
  );
}

/** Error carrying the HTTP status and the backend's field-level errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    status = 400,
    fieldErrors: Array<{ field: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Maps backend field errors onto `react-hook-form`'s `setError`. */
  applyTo(setError: (field: string, message: string) => void): void {
    if (this.fieldErrors.length > 0) {
      this.fieldErrors.forEach((e) => setError(e.field, e.message));
      return;
    }
    setError("root", this.message);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Session                                   */
/* -------------------------------------------------------------------------- */

let accessToken: string | null = readStoredToken();
const endedListeners = new Set<() => void>();

/** Latched once the refresh token is refused, so retries stop re-attempting it. */
let sessionEnded = false;

function notifySessionEnded(): void {
  sessionEnded = true;
  endedListeners.forEach((listener) => listener());
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * Holds the access token in memory and mirrors it to `localStorage`, so the value
 * survives a reload and requests made without cookies still send `Authorization`.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  // A fresh token means a fresh session; re-arm the refresh path.
  if (token) sessionEnded = false;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** Notified when the session can no longer be recovered. Returns an unsubscribe. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

/* -------------------------------------------------------------------------- */
/*                                  Requests                                  */
/* -------------------------------------------------------------------------- */

interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: Paginated<T>["meta"];
}

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** `multipart/form-data` body; the browser sets the boundary, so no Content-Type is sent. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh loops. */
  retryOnUnauthorized?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ErrorBody | undefined;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = undefined;
  }
  return new ApiError(
    body?.message ?? response.statusText ?? "Request failed",
    response.status,
    body?.errors ?? [],
  );
}

/**
 * In-flight refresh, shared by every caller. The backend revokes the whole session
 * family if a refresh token is replayed, so only one may run at a time - releasing
 * the slot on the next tick let a second 401 race the rotated cookie and log the
 * user out at random.
 */
let refreshInFlight: Promise<boolean> | null = null;

/** Bumped after a refresh completes, so a later 401 may start a new one. */
let refreshGeneration = 0;

/** Rotates the token pair through `POST /auth/refresh`. */
async function refreshSession(): Promise<boolean> {
  if (sessionEnded) return false;

  const generation = refreshGeneration;
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) return false;
      const body = (await response.json()) as SuccessBody<{ accessToken: string }>;
      setAccessToken(body.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so parallel callers share this attempt.
      setTimeout(() => (refreshInFlight = null), 0);
    }
  })();

  const settled = await refreshInFlight;

  // Only the caller that observed this generation releases the slot.
  if (refreshGeneration === generation) {
    if (settled) refreshGeneration += 1;
    refreshInFlight = null;
  }

  return settled;
}

/**
 * Performs an API call and unwraps the `{ success, data, meta }` envelope.
 *
 * A `401` triggers exactly one silent refresh + replay (the access token is short
 * lived), so an open tab does not log the user out mid-session.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal, retryOnUnauthorized = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  assertApiConfigured();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      ...(formData !== undefined
        ? { body: formData }
        : body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw toNetworkError(error);
  }

  if (response.status === 401 && retryOnUnauthorized && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      return apiFetch<T>(path, { ...options, retryOnUnauthorized: false });
    }
    // The refresh token is gone or invalid: the session is unrecoverable.
    setAccessToken(null);
    notifySessionEnded();
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as SuccessBody<T>;
  return payload.data;
}

/** Same as {@link apiFetch} but keeps the `meta` block of a list response. */
export async function apiFetchPaginated<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paginated<T>> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {};
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as SuccessBody<T[]> & { meta: Paginated<T>["meta"] };
  return { data: payload.data, meta: payload.meta };
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Builds a query string, dropping empty values. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** The backend returns `null` for absent optional columns; the UI models them as optional. */
export function optional<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}
