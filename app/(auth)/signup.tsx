import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { router, useLocalSearchParams } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { useState } from "react"
import { classifyIdentifier } from "@/utils/identifier"

export default function SignupScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [name, setName] = useState("")
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()

  const { kind, value, isValid } = classifyIdentifier(identifierInput)
  const isNameValid = name.trim().length > 0
  const canSubmit = isNameValid && isValid

  const handleSignup = async () => {
    if (!isNameValid) {
      Alert.alert("Error", "Please enter your name")
      return
    }

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
      // Guard against silently "logging in" to someone else's account under a new name
      const alreadyExists = await authApi
        .login({ identifier: value })
        .then(() => true)
        .catch((error: any) => {
          if (error.response?.status === 404) return false
          throw error
        })

      if (alreadyExists) {
        setIsLoading(false)
        Alert.alert(
          "Account already exists",
          `An account already exists for that ${kind === "email" ? "email" : "phone number"}. Please log in instead.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log In",
              onPress: () => router.replace({ pathname: "/(auth)/login", params: { identifier: value } })
            }
          ]
        )
        return
      }

      const response = await authApi.signup(
        kind === "email"
          ? { name: name.trim(), email: value }
          : { name: name.trim(), phone: value }
      )

      await SecureStore.setItemAsync("access_token", response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))

      setUser(response.user)
      router.replace("/(tabs)")
    } catch (error: any) {
      Alert.alert(
        "Sign up failed",
        error.response?.data?.detail || error.message || "Something went wrong"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />

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
            <Text className="text-4xl font-bold text-neutral-900 text-center mb-3">
              Create account
            </Text>
            <Text className="text-base text-muted text-center leading-6 mb-12">
              All your expenses across every app,{"\n"}in one clear view.
            </Text>

            <View className="w-full gap-4">
              <TextInput
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isLoading}
                className="w-full border border-border rounded-2xl px-4 py-4 text-base"
                placeholderTextColor="#9ca3af"
              />

              <View>
                <TextInput
                  placeholder="Phone number or email"
                  value={identifierInput}
                  onChangeText={setIdentifierInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  className="w-full border border-border rounded-2xl px-4 py-4 text-base"
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
                onPress={handleSignup}
                disabled={isLoading || !canSubmit}
                className={`w-full flex-row items-center justify-center ${isLoading || !canSubmit ? 'bg-neutral-200' : 'bg-primary-600'} rounded-2xl py-4`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-base font-semibold ${isLoading || !canSubmit ? 'text-neutral-400' : 'text-white'}`}>
                    Sign Up
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.replace({ pathname: "/(auth)/login", params: { identifier: identifierInput } })}
                disabled={isLoading}
                className="w-full items-center py-2"
              >
                <Text className="text-sm text-muted">
                  Already have an account?{" "}
                  <Text className="text-primary-600 font-semibold">Log In</Text>
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-muted text-center mt-4 leading-5">
                By continuing, you agree to our{" "}
                <Text className="text-primary-600">Terms of Service</Text>
                {" "}and{" "}
                <Text className="text-primary-600">Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
