import { API_URL } from "./client";

export interface ApiHealth {
  status: "ok" | "degraded" | "down";
  uptime: number;
  timestamp: string;
  /** `up` or `down`; separates "API is down" from "API is up but the database is not". */
  database: "up" | "down";
  version: string;
  environment: string;
}

/**
 * `GET /health` — public, unversioned liveness probe.
 *
 * It sits outside `/api/v1` because load balancers and uptime checks call it, and it
 * needs no token. The UI uses it to turn an opaque "Failed to fetch" into a precise
 * diagnosis: unreachable API, reachable API with a dead database, or a rejected
 * sign-in.
 */
export async function getApiHealth(signal?: AbortSignal): Promise<ApiHealth> {
  // API_URL ends with "/api/v1"; health lives at the service root.
  const base = API_URL.replace(/\/api\/v\d+$/, "");
  const response = await fetch(`${base}/health`, {
    credentials: "include",
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }

  const payload = (await response.json()) as { success: boolean; data: ApiHealth };
  return payload.data;
}

/** One-line summary used when a request could not reach the API at all. */
export async function describeApiProblem(signal?: AbortSignal): Promise<string> {
  try {
    const health = await getApiHealth(signal);
    if (health.database === "down") {
      return "The API is running but its database is unreachable. Try again shortly.";
    }
    return "The API is healthy, so the request was rejected. Please try again.";
  } catch {
    return "The API could not be reached. Check that the backend is deployed and running.";
  }
}
