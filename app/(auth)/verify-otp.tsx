import { View, Text, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { router, useLocalSearchParams } from "expo-router"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { useState, useEffect, useRef } from "react"

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30

export default function VerifyOtpScreen() {
  const params = useLocalSearchParams<{ pendingToken?: string; emailHint?: string }>()
  const pendingToken = params.pendingToken ?? ""
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const { setUser } = useUserStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCooldown(c => (c > 0 ? c - 1 : 0))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const isCodeValid = code.length === OTP_LENGTH

  const handleExpiredSession = () => {
    Alert.alert("Session expired", "Please log in again.", [
      { text: "OK", onPress: () => router.replace("/(auth)/login") }
    ])
  }

  const handleVerify = async () => {
    if (!isCodeValid) {
      Alert.alert("Error", `Enter the ${OTP_LENGTH}-digit code we emailed you`)
      return
    }

    setIsLoading(true)

    try {
      const response = await authApi.verifyOtp({ pendingToken, code })

      await SecureStore.setItemAsync("access_token", response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))

      setUser(response.user)
      router.replace("/(tabs)")
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleExpiredSession()
      } else {
        setCode("")
        Alert.alert(
          "Verification failed",
          error.response?.data?.detail || error.message || "Something went wrong"
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)

    try {
      await authApi.resendOtp(pendingToken)
      setCooldown(RESEND_COOLDOWN_SECONDS)
      Alert.alert("Code sent", "We emailed you a new verification code.")
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleExpiredSession()
      } else {
        Alert.alert(
          "Couldn't resend code",
          error.response?.data?.detail || error.message || "Something went wrong"
        )
      }
    } finally {
      setIsResending(false)
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
              <Text className="text-4xl">✉️</Text>
            </View>
            <Text className="text-4xl font-bold text-neutral-900 dark:text-white text-center mb-3">
              Check your email
            </Text>
            <Text className="text-base text-muted dark:text-neutral-400 text-center leading-6 mb-12">
              Enter the {OTP_LENGTH}-digit code we sent to{"\n"}
              {params.emailHint ? <Text className="font-semibold">{params.emailHint}</Text> : "your email"}
            </Text>

            <View className="w-full gap-4">
              <TextInput
                placeholder="000000"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                editable={!isLoading}
                autoFocus
                className="w-full border border-border dark:border-neutral-700 rounded-2xl px-4 py-4 text-2xl tracking-[8px] text-center text-neutral-900 dark:text-white"
                placeholderTextColor="#9ca3af"
              />

              <TouchableOpacity
                onPress={handleVerify}
                disabled={isLoading || !isCodeValid}
                className={`w-full flex-row items-center justify-center ${isLoading || !isCodeValid ? 'bg-neutral-200' : 'bg-primary-600'} rounded-2xl py-4`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className={`text-base font-semibold ${isLoading || !isCodeValid ? 'text-neutral-400' : 'text-white'}`}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResend}
                disabled={isResending || cooldown > 0}
                className="w-full items-center py-2"
              >
                {isResending ? (
                  <ActivityIndicator color="#6b7280" />
                ) : (
                  <Text className="text-sm text-muted dark:text-neutral-400">
                    {cooldown > 0 ? (
                      `Resend code in ${cooldown}s`
                    ) : (
                      <>
                        Didn&apos;t get a code?{" "}
                        <Text className="text-primary-600 dark:text-primary-400 font-semibold">Resend</Text>
                      </>
                    )}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
