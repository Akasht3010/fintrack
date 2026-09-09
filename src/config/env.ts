import Constants from "expo-constants"

const extra = Constants.expoConfig?.extra ?? {}

export const ENV = {
  // Per-environment: EXPO_PUBLIC_API_URL is set by the EAS build/update
  // environment (production -> prod Cloud Run, preview -> UAT Cloud Run) and
  // is inlined at bundle time. Locally, put it in a .env file or the shell
  // to point at a laptop backend. Falls back to app.json's extra.apiUrl.
  API_URL:                    process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:8000",
  GOOGLE_CLIENT_ID_IOS:       extra.googleClientIdIos   ?? "",
  GOOGLE_CLIENT_ID_WEB:       extra.googleClientIdWeb   ?? "",
  APP_ENV:                    extra.appEnv          ?? "development",
  isDev:                      (extra.appEnv ?? "development") === "development"
}
