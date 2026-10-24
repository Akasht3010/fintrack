import { Platform } from "react-native"
import { storage } from "@/utils/storage"

/**
 * Where the session lives. Native keeps the access token in the OS keychain
 * (expo-secure-store) and sends it as a bearer header. The web build has no
 * keychain — localStorage is readable by any script on the page — so it
 * uses the backend's HttpOnly session cookie instead: it sends
 * `X-Auth-Transport: cookie`, the backend sets the cookie and leaves
 * access_token null in the body, and the token is never visible to JS.
 */
export const usesCookieSession = Platform.OS === "web"

export const AUTH_TRANSPORT_HEADERS: Record<string, string> = usesCookieSession
  ? { "X-Auth-Transport": "cookie" }
  : {}

// Web only: when the backend last issued/renewed the cookie, so requests can
// renew it before its 30-minute expiry. In memory on purpose — after a page
// reload it's unknown, and app start renews the cookie (see renewCookieSession).
let cookieIssuedAt: number | null = null

export function noteCookieSessionIssued(): void {
  cookieIssuedAt = Date.now()
}

export function cookieSessionAgeMs(): number | null {
  return cookieIssuedAt === null ? null : Date.now() - cookieIssuedAt
}

/** Persist the session an auth endpoint just issued. */
export async function saveSession(accessToken: string | null | undefined): Promise<void> {
  if (usesCookieSession) {
    noteCookieSessionIssued()
    return
  }
  if (!accessToken) throw new Error("Sign-in response had no access token")
  await storage.setItemAsync("access_token", accessToken)
}

/** Forget the local session. On web this also removes any token an older
 *  build left in localStorage; the cookie itself is cleared server-side. */
export async function clearStoredSession(): Promise<void> {
  cookieIssuedAt = null
  await storage.deleteItemAsync("access_token")
}
