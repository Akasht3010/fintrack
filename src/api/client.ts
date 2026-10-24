import axios from "axios"
import { storage as SecureStore } from "@/utils/storage"
import { ENV } from "@/config/env"
import { useUserStore } from "@/store/useUserStore"
import { showAlert } from "@/utils/alert"
import {
  AUTH_TRANSPORT_HEADERS,
  cookieSessionAgeMs,
  noteCookieSessionIssued,
  usesCookieSession
} from "@/utils/session"

export const apiClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: 10000,
  // Web authenticates with the backend's HttpOnly session cookie — see
  // src/utils/session.ts.
  withCredentials: usesCookieSession,
  headers: {
    "Content-Type": "application/json",
    ...AUTH_TRANSPORT_HEADERS
  }
})

// `HTTPException(detail="...")` sends `{ detail: "some string" }`, which every
// call site used to read directly as `error.response?.data?.detail`. But a
// Pydantic validation failure (422) goes through FastAPI's own default
// handler instead, which sends `{ detail: [{ loc, msg, type }, ...] }` — an
// array, not a string. Read raw, that renders "[object Object]" in an Alert.
// This normalizes both shapes (plus a plain error.message fallback) to a
// single readable string.
export function extractErrorMessage(error: any, fallback = "Something went wrong"): string {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string" && detail) {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => (typeof item?.msg === "string" ? item.msg : null))
      .filter((msg): msg is string => Boolean(msg))
    if (messages.length > 0) {
      return messages.join("\n")
    }
  }
  return error?.message || fallback
}

// Access tokens carry a standard JWT `exp` claim — read only (no signature
// check needed client-side, the server verifies that) so a request made
// close to expiry can trigger a proactive refresh instead of failing.
function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1]
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    )
    const { exp } = JSON.parse(json)
    return typeof exp === "number" ? exp * 1000 : null
  } catch {
    return null
  }
}

// Refresh once the token has less than this long left — comfortably inside
// the 30-minute server-side expiry so a request that starts just before the
// threshold still lands with a valid token.
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

let refreshPromise: Promise<string | null> | null = null

// Web: renew the cookie once it's this old (server-side expiry is 30 min).
const COOKIE_RENEW_AFTER_MS = 25 * 60 * 1000
let cookieRenewPromise: Promise<boolean> | null = null

/** Asks the backend to re-issue the session cookie. Resolves false if the
 *  session is already gone. Bare axios for the same reason as
 *  refreshAccessToken below. */
export function renewCookieSession(): Promise<boolean> {
  if (!cookieRenewPromise) {
    cookieRenewPromise = axios
      .post(`${ENV.API_URL}/api/auth/refresh`, null, {
        withCredentials: true,
        headers: AUTH_TRANSPORT_HEADERS,
        timeout: 10000
      })
      .then(() => {
        noteCookieSessionIssued()
        return true
      })
      .catch(() => false)
      .finally(() => {
        cookieRenewPromise = null
      })
  }
  return cookieRenewPromise
}

async function refreshAccessToken(currentToken: string): Promise<string | null> {
  try {
    // A bare axios call, not apiClient — going through apiClient's own
    // request interceptor here would recurse back into this function.
    const response = await axios.post<{ access_token: string }>(
      `${ENV.API_URL}/api/auth/refresh`,
      null,
      { headers: { Authorization: `Bearer ${currentToken}` }, timeout: 10000 }
    )
    const freshToken = response.data.access_token
    await SecureStore.setItemAsync("access_token", freshToken)
    return freshToken
  } catch {
    // Most likely the token was already expired by the time this ran (e.g.
    // the app was backgrounded) — let the normal 401 -> logout flow below
    // handle it instead of failing the request differently here.
    return null
  }
}

async function getFreshAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync("access_token")
  if (!token) return null

  const expiryMs = getTokenExpiryMs(token)
  // A decode failure (corrupted storage, unexpected token shape) means the
  // expiry can't be trusted either way — refresh now rather than sending a
  // token straight to the server that's likely to just 401 there instead.
  if (expiryMs !== null && expiryMs - Date.now() >= REFRESH_THRESHOLD_MS) {
    return token
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(token).finally(() => {
      refreshPromise = null
    })
  }
  const refreshed = await refreshPromise
  return refreshed ?? token
}

apiClient.interceptors.request.use(async (config) => {
  if (usesCookieSession) {
    // The browser attaches the cookie itself; only keep it from expiring.
    // Unknown age (fresh page load, signed out) is left alone — app start
    // renews explicitly, and an unauthenticated request has nothing to renew.
    const age = cookieSessionAgeMs()
    if (age !== null && age >= COOKIE_RENEW_AFTER_MS) {
      await renewCookieSession()
    }
    return config
  }

  const token = await getFreshAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A session only reaches this point (a 401/403 actually hitting the
// response interceptor) once the proactive refresh above has already had —
// and missed — its chance, e.g. the app was backgrounded past the full
// 30-minute expiry. Both statuses matter: our own get_current_user raises
// 401 for an expired/invalid token, but FastAPI's HTTPBearer raises 403 by
// default when the Authorization header is missing entirely — which is
// exactly what happens on the next request after this handler clears the
// token. The app never uses 403 for anything else, so it's safe to treat
// both as "session's over."
let isHandlingSessionExpiry = false

// Endpoints whose 401 means "these credentials/codes are wrong", not "your
// session ended" — the caller shows that error itself. Treating them as
// expiry fired a pointless /logout (and, on web, /clear-session) on every
// mistyped password or expired code.
const NON_SESSION_AUTH_PATHS = [
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/google/exchange",
  "/api/auth/logout",
  "/api/auth/clear-session"
]

export function isSessionExpiryResponse(status: number | undefined, url: string | undefined): boolean {
  if (status !== 401 && status !== 403) return false
  const path = (url ?? "").split("?")[0]
  return !NON_SESSION_AUTH_PATHS.some((p) => path.endsWith(p))
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isSessionExpiryResponse(error.response?.status, error.config?.url) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true
      const wasAuthenticated = useUserStore.getState().isAuthenticated
      await useUserStore.getState().logout()
      // Only alert if this cut a session actively in use — a cold start
      // with an already-expired stored token has isAuthenticated false the
      // whole time, and should just quietly land on the login screen.
      if (wasAuthenticated) {
        showAlert("Session expired", "Please log in again.")
      }
      isHandlingSessionExpiry = false
    }
    return Promise.reject(error)
  }
)
