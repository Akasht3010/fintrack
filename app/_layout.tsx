import { useEffect } from "react"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useColorScheme } from "nativewind"
import * as SecureStore from "expo-secure-store"
import * as SplashScreen from "expo-splash-screen"
import { useUserStore } from "@/store/useUserStore"
import { useThemeStore } from "@/store/useThemeStore"
import { authApi } from "@/api/endpoints/auth"
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
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"
  // React Navigation's own scene background defaults to pure #000000 in dark
  // mode (from its automatic DarkTheme), which is a visibly different shade
  // than our neutral-950 screens — wherever the navigator's raw background
  // peeks through, that mismatch shows up as a seam. Pin it to match exactly.
  const sceneBackgroundColor = isDark ? "#0a0a0a" : "#f9fafb"

  useEffect(() => {
    Promise.all([checkAuth(), hydrateTheme()])
  }, [])

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
  }, [isLoading])

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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: sceneBackgroundColor } }}>
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
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootLayoutNav />
    </QueryClientProvider>
  )
}
