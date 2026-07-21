import { useEffect } from "react"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as SecureStore from "expo-secure-store"
import * as SplashScreen from "expo-splash-screen"
import { useUserStore } from "@/store/useUserStore"
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

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/(tabs)/")
      } else {
        router.replace("/(auth)/login")
      }
    }
  }, [isLoading])

  const checkAuth = async () => {
    try {
      // Clear tokens to force login
      await SecureStore.deleteItemAsync("access_token")
      await SecureStore.deleteItemAsync("user")
      setLoading(false)
    } catch (err) {
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
