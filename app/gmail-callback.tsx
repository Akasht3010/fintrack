import { useEffect, useRef } from "react"
import { View, Text, ActivityIndicator, Alert } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { Colors } from "@/constants/colors"

/**
 * Landing screen for the Gmail OAuth redirect
 * (exp://.../--/gmail-callback?gmail_connected=true|error=...), reached when
 * the backend bounces the browser back after Google consent.
 *
 * WebBrowser.openAuthSessionAsync (see useGmailConnect) is supposed to
 * intercept this redirect itself before it ever reaches the app's router,
 * but that interception is unreliable on Android/Expo Go — when it misses,
 * the OS hands the deep link straight to Expo Router, which needs an actual
 * matching screen here or the user is stranded on "Unmatched Route".
 */
export default function GmailCallback() {
  const { gmail_connected, error } = useLocalSearchParams<{ gmail_connected?: string; error?: string }>()
  const { setUser } = useUserStore()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    WebBrowser.dismissBrowser()

    const finish = async () => {
      if (gmail_connected === "true") {
        try {
          const user = await authApi.getMe()
          await SecureStore.setItemAsync("user", JSON.stringify(user))
          setUser(user)
        } catch {
          // Best-effort — Profile will reflect the real state next time it fetches the user.
        }
      } else {
        Alert.alert("Couldn't connect Gmail", typeof error === "string" ? error : "Gmail connect failed")
      }
      router.replace("/(tabs)/profile")
    }

    finish()
  }, [])

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-black">
      <ActivityIndicator size="large" color={Colors.primary[600]} />
      <Text className="mt-4 text-sm text-muted dark:text-neutral-400">Finishing Gmail connection…</Text>
    </View>
  )
}
