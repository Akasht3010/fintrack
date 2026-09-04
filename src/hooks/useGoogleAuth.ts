import { useState } from "react"
import { Platform } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import * as Linking from "expo-linking"
import Constants from "expo-constants"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { ENV } from "@/config/env"
import { authApi } from "@/api/endpoints/auth"

WebBrowser.maybeCompleteAuthSession()

/**
 * Google sign-in is mediated by the backend rather than done purely
 * client-side: Google requires a stable https (or localhost) redirect URI,
 * but Expo Go's own deep link changes every session (exp://<lan-ip>:8081/...).
 * So the app opens the backend's /api/auth/google/authorize, which redirects
 * to Google; Google redirects back to the backend's fixed /callback; and the
 * backend then redirects the browser to *our* dynamic deep link with our own
 * JWT attached, which WebBrowser.openAuthSessionAsync catches.
 */
export interface GoogleSignInResult {
  success: boolean
  error?: string
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()

  const signIn = async (): Promise<GoogleSignInResult> => {
    setIsLoading(true)

    try {
      // In a real build (dev client / preview / production) pin our own custom
      // scheme so the redirect back into the app is `fintrack://auth-callback`
      // — resolvable on any network. In Expo Go the `fintrack://` scheme isn't
      // registered, so let makeRedirectUri pick the Expo Go form instead:
      // `exp://<metro-lan-ip>:8081/...` when loaded from a local dev server
      // (only works on that Wi-Fi), or `exp://u.expo.dev/<project>/...` when
      // loaded from a published EAS Update (public, works on cellular).
      const inExpoGo = Constants.appOwnership === "expo"
      const appRedirectUri = AuthSession.makeRedirectUri(
        inExpoGo ? { path: "auth-callback" } : { scheme: "fintrack", path: "auth-callback" }
      )
      const authorizeUrl = `${ENV.API_URL}/api/auth/google/authorize?app_redirect_uri=${encodeURIComponent(appRedirectUri)}`

      if (Platform.OS === "web") {
        // Popups are unreliable on web (blocked by popup blockers/extensions,
        // and window.opener can get severed across the cross-origin redirect
        // chain through Google and back). A full-page redirect sidesteps all
        // of that — auth-callback.tsx already handles landing here as a
        // normal navigation, since it's the same fallback route the native
        // flow uses when WebBrowser's popup-intercept doesn't fire.
        window.location.href = authorizeUrl
        return new Promise<GoogleSignInResult>(() => {}) // page is navigating away
      }

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, appRedirectUri)

      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false }
      }

      if (result.type !== "success" || !result.url) {
        return { success: false, error: "Google sign-in failed" }
      }

      const token = Linking.parse(result.url).queryParams?.token
      if (!token || typeof token !== "string") {
        return { success: false, error: "Google sign-in did not return a token" }
      }

      await SecureStore.setItemAsync("access_token", token)
      const user = await authApi.getMe()
      await SecureStore.setItemAsync("user", JSON.stringify(user))
      setUser(user)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message ?? "Something went wrong" }
    } finally {
      setIsLoading(false)
    }
  }

  return { signIn, isLoading }
}
