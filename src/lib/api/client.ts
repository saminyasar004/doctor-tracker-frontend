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
 * Resolves the API base URL, preferring an explicit setting over the local default:
 *
 * 1. `window.__DOCTOR_TRACKER_API_URL__` — runtime override, useful when the bundle
 *    is served from a host whose API address is only known at deploy time.
 * 2. `VITE_API_URL` — baked in at build time; set this in the Netlify environment.
 * 3. `http://localhost:4000/api/v1` — local development fallback.
 *
 * Falling through to (3) on a non-local host means the bundle was built without
 * `VITE_API_URL`; that is detected in {@link assertApiConfigured} so the user gets
 * an actionable message instead of the browser's opaque "Failed to fetch".
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
const listeners = new Set<(token: string | null) => void>();

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * Holds the access token in memory and mirrors it to `localStorage`.
 *
 * The backend also sets httpOnly cookies, so the browser is authenticated even if
 * this value is lost; the token is kept so requests made from contexts that
 * cannot rely on cookies (and so the value survives a full page reload) still
 * carry `Authorization: Bearer`.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  listeners.forEach((listener) => listener(token));
}

export function onTokenChange(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return accessToken;
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

let refreshInFlight: Promise<boolean> | null = null;

/** Rotates the token pair through `POST /auth/refresh`. Concurrent callers share one request. */
async function refreshSession(): Promise<boolean> {
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
  return refreshInFlight;
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
    setAccessToken(null);
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
