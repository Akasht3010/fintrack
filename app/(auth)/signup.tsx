import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { router, useLocalSearchParams } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { useState } from "react"
import { classifyIdentifier, isValidEmail, isValidPhone } from "@/utils/identifier"
import { useGoogleAuth } from "@/hooks/useGoogleAuth"

export default function SignupScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const prefill = classifyIdentifier(params.identifier ?? "")

  const [name, setName] = useState("")
  const [email, setEmail] = useState(prefill.kind === "email" ? prefill.value : "")
  const [phone, setPhone] = useState(prefill.kind === "phone" ? prefill.value : "")
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth()

  const isNameValid = name.trim().length > 0
  const isEmailValid = isValidEmail(email)
  const isPhoneValid = isValidPhone(phone)
  const canSubmit = isNameValid && isEmailValid && isPhoneValid

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle()
    if (result.success) {
      router.replace("/(tabs)")
    } else if (result.error) {
      Alert.alert("Google sign-in failed", result.error)
    }
  }

  const handleSignup = async () => {
    if (!isNameValid) {
      Alert.alert("Error", "Please enter your name")
      return
    }

    if (!isEmailValid) {
      Alert.alert("Invalid email", "Please enter a valid email address")
      return
    }

    if (!isPhoneValid) {
      Alert.alert("Invalid phone", "Please enter a valid 10-digit phone number")
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, "")
      })

      await SecureStore.setItemAsync("access_token", response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))

      setUser(response.user)
      router.replace("/(tabs)")
    } catch (error: any) {
      if (error.response?.status === 409) {
        Alert.alert(
          "Account already exists",
          error.response?.data?.detail || "This email or phone number is already registered.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log In",
              onPress: () => router.replace({ pathname: "/(auth)/login", params: { identifier: email.trim() } })
            }
          ]
        )
      } else {
        Alert.alert(
          "Sign up failed",
          error.response?.data?.detail || error.message || "Something went wrong"
        )
      }
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
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  className="w-full border border-border rounded-2xl px-4 py-4 text-base"
                  placeholderTextColor="#9ca3af"
                />
                {email.trim().length > 0 && !isEmailValid && (
                  <Text className="text-xs text-red-500 mt-2">
                    Please enter a valid email address
                  </Text>
                )}
              </View>

              <View>
                <TextInput
                  placeholder="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!isLoading}
                  className="w-full border border-border rounded-2xl px-4 py-4 text-base"
                  placeholderTextColor="#9ca3af"
                />
                {phone.trim().length > 0 && !isPhoneValid && (
                  <Text className="text-xs text-red-500 mt-2">
                    Please enter a valid 10-digit phone number
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

              <View className="flex-row items-center gap-3 my-1">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-xs text-muted">or</Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                className="w-full flex-row items-center justify-center border border-border rounded-2xl py-4"
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text className="text-base font-semibold text-neutral-900">
                    Continue with Google
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.replace({ pathname: "/(auth)/login", params: { identifier: email || phone } })}
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
