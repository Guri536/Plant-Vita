/**
 * lib/api.js
 *
 * Thin wrapper around fetch() that:
 *   - Prepends the public API base URL
 *   - Injects the Bearer token when provided
 *   - Throws a descriptive error on non-OK responses
 *
 * Usage (in a client component):
 *   const { data: session } = useSession();
 *   const plants = await apiFetch("/dashboard/plants", session?.accessToken);
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/**
 * @param {string} path        - e.g. "/dashboard/plants"
 * @param {string|null} token  - FastAPI JWT access token
 * @param {RequestInit} opts   - extra fetch options (method, body, …)
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, token = null, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  return fetch(`${API_URL}${path}`, { ...opts, headers });
}

/**
 * Convenience: fetch + parse JSON, throws on error.
 */
export async function apiGet(path, token = null) {
  const res = await apiFetch(path, token);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Convenience: POST JSON body, parse JSON response.
 */
export async function apiPost(path, body, token = null) {
  const res = await apiFetch(path, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Convenience: PATCH JSON body, parse JSON response.
 */
export async function apiPatch(path, body, token = null) {
  const res = await apiFetch(path, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}