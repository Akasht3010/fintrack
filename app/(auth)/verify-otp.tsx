import { router, useLocalSearchParams } from "expo-router"
import { useState, useEffect, useRef } from "react"
import { storage as SecureStore } from "@/utils/storage"
import { saveSession } from "@/utils/session"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { AuthScreen } from "@/components/layout/AuthScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field } from "@/components/ui/misc"

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30

export default function VerifyOtpScreen() {
  const params = useLocalSearchParams<{ pendingToken?: string; emailHint?: string; flow?: string }>()
  const pendingToken = params.pendingToken ?? ""
  // Login/signup by default; "email-change" confirms a new address for an
  // already signed-in user and returns to the app rather than to login.
  const isEmailChange = params.flow === "email-change"
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
    if (isEmailChange) {
      showAlert("Code expired", "Please start the email change again.", () => router.replace("/(tabs)/profile"))
      return
    }
    showAlert("Session expired", "Please log in again.", () => router.replace("/(auth)/login"))
  }

  const handleVerify = async () => {
    if (!isCodeValid) {
      showAlert("Error", `Enter the ${OTP_LENGTH}-digit code we emailed you`)
      return
    }

    setIsLoading(true)
    try {
      const response = isEmailChange
        ? await authApi.confirmEmailChange({ pendingToken, code })
        : await authApi.verifyOtp({ pendingToken, code })

      await saveSession(response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))

      setUser(response.user)
      if (isEmailChange) {
        showAlert("Email updated", `Your email is now ${response.user.email}. Other devices have been signed out.`)
        router.replace("/(tabs)/profile")
        return
      }
      router.replace("/(tabs)")
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleExpiredSession()
      } else {
        setCode("")
        showAlert("Verification failed", extractErrorMessage(error))
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
      showAlert("Code sent", "We emailed you a new verification code.")
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleExpiredSession()
      } else {
        showAlert("Couldn't resend code", extractErrorMessage(error))
      }
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthScreen
      title="Check your email"
      subtitle={
        <>
          Enter the {OTP_LENGTH}-digit code we sent to{" "}
          {params.emailHint ? <Text className="text-sm font-medium text-foreground">{params.emailHint}</Text> : "your email"}.
        </>
      }
      footer={
        <Button variant="ghost" onPress={handleResend} loading={isResending} disabled={cooldown > 0}>
          <Text className="text-muted-foreground">{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</Text>
        </Button>
      }
    >
      <Field label="Verification code">
        <Input
          accessibilityLabel="Verification code"
          placeholder="000000"
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={OTP_LENGTH}
          editable={!isLoading}
          autoFocus
          onSubmitEditing={() => isCodeValid && handleVerify()}
          className="text-center text-lg tracking-[6px]"
        />
      </Field>
      <Button onPress={handleVerify} loading={isLoading} disabled={!isCodeValid}>
        <Text>Verify</Text>
      </Button>
    </AuthScreen>
  )
}
