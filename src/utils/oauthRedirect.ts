import { Platform } from "react-native"
import * as AuthSession from "expo-auth-session"
import Constants from "expo-constants"

/**
 * Cloud Run serves the web app and API from the same origin. Use an explicit
 * root callback URL on web so the backend's redirect allowlist sees exactly
 * https://<app-origin>/<callback>. Native apps keep their custom scheme, and
 * Expo Go keeps its session-specific exp:// URL during local development.
 */
export function makeAppOAuthRedirectUri(path: "auth-callback" | "gmail-callback"): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL(`/${path}`, window.location.origin).toString()
  }

  const inExpoGo = Constants.appOwnership === "expo"
  return AuthSession.makeRedirectUri(
    inExpoGo ? { path } : { scheme: "fintrack", path }
  )
}
