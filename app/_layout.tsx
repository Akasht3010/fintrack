import { useEffect } from "react"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { storage as SecureStore } from "@/utils/storage"
import * as SplashScreen from "expo-splash-screen"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useUserStore } from "@/store/useUserStore"
import { useThemeStore } from "@/store/useThemeStore"
import { authApi } from "@/api/endpoints/auth"
import { useBillReminders } from "@/hooks/useBillReminders"
import { useGmailAutoSync } from "@/hooks/useGmailAutoSync"
import "../src/constants/global.css"

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5
    }
  }
})

function RootLayoutNav() {
  const { isAuthenticated, isLoading, setUser, setLoading } = useUserStore()
  const hydrateTheme = useThemeStore((state) => state.hydrate)

  useEffect(() => {
    Promise.all([checkAuth(), hydrateTheme()])
  }, [])

  useBillReminders(isAuthenticated)
  useGmailAutoSync(isAuthenticated)

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/(tabs)")
      } else {
        router.replace("/(auth)/login")
      }
    }
    // isAuthenticated is a dep (not just isLoading) so a mid-session logout
    // (manual sign-out, or the api client force-logging-out on a 401) sends
    // the user back to the login screen instead of leaving them stranded on
    // a now-broken authenticated screen.
  }, [isLoading, isAuthenticated])

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync("access_token")
      if (!token) {
        return
      }

      // Validates the token and refreshes the cached user in one step —
      // if it's expired/invalid this throws and we fall through to clearing
      // the stale session instead of leaving the user stuck on a broken one.
      const user = await authApi.getMe()
      await SecureStore.setItemAsync("user", JSON.stringify(user))
      setUser(user)
    } catch (err) {
      await SecureStore.deleteItemAsync("access_token")
      await SecureStore.deleteItemAsync("refresh_token")
      await SecureStore.deleteItemAsync("user")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(modals)/transaction-detail"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/add-expense"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/add-budget"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/recurring"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/export"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/categories"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/accounts"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/edit-profile"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="(modals)/delete-account"
        options={{ presentation: "modal" }}
      />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" translucent backgroundColor="transparent" hidden={false} />
        <RootLayoutNav />
      </SafeAreaProvider>
    </QueryClientProvider>
  )
}
