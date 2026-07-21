import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { router, useLocalSearchParams } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { useState, useEffect } from "react"
import { classifyIdentifier } from "@/utils/identifier"
import { useGoogleAuth } from "@/hooks/useGoogleAuth"

export default function LoginScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth()

  useEffect(() => {
    clearOldTokens()
  }, [])

  const clearOldTokens = async () => {
    try {
      await SecureStore.deleteItemAsync("access_token")
      await SecureStore.deleteItemAsync("user")
    } catch (err) {
      console.log("No tokens to clear")
    }
  }

  const { kind, value, isValid } = classifyIdentifier(identifierInput)

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle()
    if (result.success) {
      router.replace("/(tabs)")
    } else if (result.error) {
      Alert.alert("Google sign-in failed", result.error)
    }
  }

  const handleLogin = async () => {
    if (!identifierInput.trim()) {
      Alert.alert("Error", "Please enter a phone number or email")
      return
    }

    if (!isValid) {
      Alert.alert(
        "Invalid input",
        kind === "email"
          ? "Please enter a valid email address"
          : "Please enter a valid 10-digit phone number"
      )
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.login({ identifier: value })

      await SecureStore.setItemAsync("access_token", response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))

      setUser(response.user)
      router.replace("/(tabs)")
    } catch (error: any) {
      if (error.response?.status === 404) {
        Alert.alert(
          "No account found",
          `We couldn't find an account for that ${kind === "email" ? "email" : "phone number"}.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign Up",
              onPress: () => router.push({ pathname: "/(auth)/signup", params: { identifier: value } })
            }
          ]
        )
      } else {
        Alert.alert(
          "Sign in failed",
          error.response?.data?.detail || error.message || "Something went wrong"
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950">
      <StatusBar style="auto" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 items-center justify-center px-6">
            <View className="w-20 h-20 rounded-3xl bg-primary-500 items-center justify-center mb-8">
              <Text className="text-4xl">₹</Text>
            </View>
            <Text className="text-4xl font-bold text-neutral-900 dark:text-white text-center mb-3">
              Fintrack
            </Text>
            <Text className="text-base text-muted dark:text-neutral-400 text-center leading-6 mb-12">
              All your expenses across every app,{"\n"}in one clear view.
            </Text>

            <View className="w-full gap-4">
              <View>
                <TextInput
                  placeholder="Phone number or email"
                  value={identifierInput}
                  onChangeText={setIdentifierInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  className="w-full border border-border dark:border-neutral-700 rounded-2xl px-4 py-4 text-base text-neutral-900 dark:text-white"
                  placeholderTextColor="#9ca3af"
                />
                {identifierInput.trim().length > 0 && !isValid && (
                  <Text className="text-xs text-red-500 mt-2">
                    {kind === "email"
                      ? "Please enter a valid email address"
                      : "Please enter a valid 10-digit phone number"}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading || !isValid}
                className={`w-full flex-row items-center justify-center ${isLoading || !isValid ? 'bg-neutral-200' : 'bg-primary-600'} rounded-2xl py-4`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-base font-semibold ${isLoading || !isValid ? 'text-neutral-400' : 'text-white'}`}>
                    Log In
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center gap-3 my-1">
                <View className="flex-1 h-px bg-border dark:bg-neutral-800" />
                <Text className="text-xs text-muted dark:text-neutral-400">or</Text>
                <View className="flex-1 h-px bg-border dark:bg-neutral-800" />
              </View>

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className="w-full flex-row items-center justify-center border border-border dark:border-neutral-700 rounded-2xl py-4"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text className="text-base font-semibold text-neutral-900 dark:text-white">
                    Continue with Google
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(auth)/signup", params: { identifier: identifierInput } })}
                disabled={isLoading}
                className="w-full items-center py-2"
              >
                <Text className="text-sm text-muted dark:text-neutral-400">
                  Don&apos;t have an account?{" "}
                  <Text className="text-primary-600 dark:text-primary-400 font-semibold">Sign Up</Text>
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-muted dark:text-neutral-400 text-center mt-4 leading-5">
                By continuing, you agree to our{" "}
                <Text className="text-primary-600 dark:text-primary-400">Terms of Service</Text>
                {" "}and{" "}
                <Text className="text-primary-600 dark:text-primary-400">Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
