import Constants from "expo-constants"

const extra = Constants.expoConfig?.extra ?? {}

const BACKEND_PORT = 8000

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/

function resolveApiUrl(): string {
  // In dev, derive the Mac's current LAN IP from the Metro bundler host so
  // physical devices/simulators keep working even after the IP changes
  // (Wi-Fi reconnects, DHCP renewal, etc.) instead of relying on a hardcoded IP.
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost
  const host = hostUri?.split(":")[0]
  // Only trust `host` when it's a bare LAN IPv4 address. When running
  // `expo start --tunnel` (e.g. on iPhone hotspot networks that assign
  // CLAT/NAT64 addresses like 192.0.0.x with no real LAN route), hostUri is
  // a public tunnel hostname instead — appending :8000 to that doesn't
  // route anywhere, so fall back to the configured public API URL instead.
  if (host && IPV4_RE.test(host)) {
    return `http://${host}:${BACKEND_PORT}`
  }
  return extra.apiUrl ?? "http://localhost:8000"
}

export const ENV = {
  API_URL:                    resolveApiUrl(),
  GOOGLE_CLIENT_ID_IOS:       extra.googleClientIdIos   ?? "",
  GOOGLE_CLIENT_ID_WEB:       extra.googleClientIdWeb   ?? "",
  APP_ENV:                    extra.appEnv          ?? "development",
  isDev:                      (extra.appEnv ?? "development") === "development"
}
