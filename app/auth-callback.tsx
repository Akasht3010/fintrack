import { useEffect, useRef } from "react"
import { View, Text, ActivityIndicator, Alert } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { Colors } from "@/constants/colors"

/**
 * Landing screen for the Google sign-in OAuth redirect
 * (exp://.../--/auth-callback?token=...|error=...). Same fallback role as
 * gmail-callback.tsx — WebBrowser.openAuthSessionAsync (see useGoogleAuth)
 * is meant to intercept this before Expo Router ever sees it, but that
 * interception isn't reliable on Android/Expo Go, so this route has to
 * exist for real or the user lands on "Unmatched Route" mid sign-in.
 */
export default function AuthCallback() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>()
  const { setUser } = useUserStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    WebBrowser.dismissBrowser()

    const finish = async () => {
      if (typeof token === "string" && token) {
        try {
          await SecureStore.setItemAsync("access_token", token)
          const user = await authApi.getMe()
          await SecureStore.setItemAsync("user", JSON.stringify(user))
          setUser(user)
          router.replace("/(tabs)")
          return
        } catch {
          Alert.alert("Google sign-in failed", "Something went wrong finishing sign-in")
        }
      } else {
        Alert.alert("Google sign-in failed", typeof error === "string" ? error : "Google sign-in did not return a token")
      }
      router.replace("/(auth)/login")
    }

    finish()
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      <ActivityIndicator size="large" color={Colors.primary[600]} />
      <Text className="mt-4 text-sm text-muted dark:text-neutral-400">Finishing sign-in…</Text>
    </View>
  )
}
