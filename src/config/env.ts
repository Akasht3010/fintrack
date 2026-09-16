import Constants from "expo-constants"

const extra = Constants.expoConfig?.extra ?? {}

export const ENV = {
  // Per-environment: EXPO_PUBLIC_API_URL is set by the EAS build/update
  // environment (production -> prod Cloud Run, preview -> UAT Cloud Run) and
  // is inlined at bundle time. Locally, put it in a .env file or the shell
  // to point at a laptop backend. Falls back to app.json's extra.apiUrl, then
  // to localhost — that last fallback should never actually be reached in a
  // shipped build (EAS always sets EXPO_PUBLIC_API_URL / extra.apiUrl); it
  // only fires if a build config regresses, so a broken API_URL is the
  // signal to check for that rather than a real localhost target.
  API_URL:                    process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:8000",
  GOOGLE_CLIENT_ID_IOS:       extra.googleClientIdIos   ?? "",
  GOOGLE_CLIENT_ID_WEB:       extra.googleClientIdWeb   ?? "",
  APP_ENV:                    extra.appEnv          ?? "development",
  isDev:                      (extra.appEnv ?? "development") === "development"
}
