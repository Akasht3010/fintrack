import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { router, useLocalSearchParams } from "expo-router"
import { authApi } from "@/api/endpoints/auth"
import { useState } from "react"
import { classifyIdentifier } from "@/utils/identifier"

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [isLoading, setIsLoading] = useState(false)

  const { kind, value, isValid } = classifyIdentifier(identifierInput)

  const handleSubmit = async () => {
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
      const response = await authApi.forgotPassword({ identifier: value })

      router.push({
        pathname: "/(auth)/reset-password",
        params: { pendingToken: response.pending_token, emailHint: response.email_hint }
      })
    } catch (error: any) {
      if (error.response?.status === 404) {
        Alert.alert(
          "No account found",
          `We couldn't find an account for that ${kind === "email" ? "email" : "phone number"}.`
        )
      } else {
        Alert.alert(
          "Couldn't send code",
          error.response?.data?.detail || error.message || "Something went wrong"
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-neutral-950">
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
              <Text className="text-4xl">🔑</Text>
            </View>
            <Text className="text-4xl font-bold text-neutral-900 dark:text-white text-center mb-3">
              Reset password
            </Text>
            <Text className="text-base text-muted dark:text-neutral-400 text-center leading-6 mb-12">
              Enter your phone number or email and{"\n"}we'll send you a verification code
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
                  autoFocus
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
                onPress={handleSubmit}
                disabled={isLoading || !isValid}
                className={`w-full flex-row items-center justify-center ${isLoading || !isValid ? 'bg-neutral-200' : 'bg-primary-600'} rounded-2xl py-4`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-base font-semibold ${isLoading || !isValid ? 'text-neutral-400' : 'text-white'}`}>
                    Send code
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                disabled={isLoading}
                className="w-full items-center py-2"
              >
                <Text className="text-sm text-muted dark:text-neutral-400">
                  Back to <Text className="text-primary-600 dark:text-primary-400 font-semibold">Log In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
