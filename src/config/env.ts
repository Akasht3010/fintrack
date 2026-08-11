import Constants from "expo-constants"

const extra = Constants.expoConfig?.extra ?? {}

export const ENV = {
  // Always hits the deployed Railway backend — there's no locally-running
  // backend to fall back to, so a Metro-LAN-IP-based override isn't useful here.
  API_URL:                    extra.apiUrl ?? "http://localhost:8000",
  GOOGLE_CLIENT_ID_IOS:       extra.googleClientIdIos   ?? "",
  GOOGLE_CLIENT_ID_WEB:       extra.googleClientIdWeb   ?? "",
  APP_ENV:                    extra.appEnv          ?? "development",
  isDev:                      (extra.appEnv ?? "development") === "development"
}
