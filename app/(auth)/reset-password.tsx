import { Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useState, useEffect, useRef } from "react"
import { storage as SecureStore } from "@/utils/storage"
import { saveSession } from "@/utils/session"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { useTheme } from "@/lib/theme"
import { AuthScreen } from "@/components/layout/AuthScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field } from "@/components/ui/misc"

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30
const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ pendingToken?: string; emailHint?: string }>()
  const pendingToken = params.pendingToken ?? ""
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const { setUser } = useUserStore()
  const { colors } = useTheme()
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
  const isPasswordValid = newPassword.length >= MIN_PASSWORD_LENGTH
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmNewPassword
  const canSubmit = isCodeValid && isPasswordValid && doPasswordsMatch

  const handleExpiredSession = () => {
    showAlert("Session expired", "Please start over.", () => router.replace("/(auth)/login"))
  }

  const handleSubmit = async () => {
    if (!isCodeValid) {
      showAlert("Error", `Enter the ${OTP_LENGTH}-digit code we emailed you`)
      return
    }
    if (!isPasswordValid) {
      showAlert("Weak password", `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (!doPasswordsMatch) {
      showAlert("Passwords don't match", "Make sure both password fields are the same")
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.resetPassword({ pendingToken, code, newPassword, confirmNewPassword })
      await saveSession(response.access_token)
      await SecureStore.setItemAsync("user", JSON.stringify(response.user))
      setUser(response.user)
      router.replace("/(tabs)")
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleExpiredSession()
      } else {
        setCode("")
        showAlert("Couldn't reset password", extractErrorMessage(error))
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
      title="Choose a new password"
      subtitle={
        <>
          Enter the code we sent to{" "}
          {params.emailHint ? <Text className="text-sm font-medium text-foreground">{params.emailHint}</Text> : "your email"} and a new password.
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
          className="text-center text-lg tracking-[6px]"
        />
      </Field>
      <Field
        label="New password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        error={newPassword.length > 0 && !isPasswordValid && `Password must be at least ${MIN_PASSWORD_LENGTH} characters`}
      >
        <Input
          accessibilityLabel="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!isLoading}
          invalid={newPassword.length > 0 && !isPasswordValid}
          trailing={
            <Pressable
              onPress={() => setIsPasswordVisible(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
              hitSlop={10}
              className="web:cursor-pointer"
            >
              <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={17} color={colors.mutedForeground} />
            </Pressable>
          }
        />
      </Field>
      <Field label="Confirm new password" error={confirmNewPassword.length > 0 && !doPasswordsMatch && "Passwords don't match"}>
        <Input
          accessibilityLabel="Confirm new password"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          invalid={confirmNewPassword.length > 0 && !doPasswordsMatch}
        />
      </Field>
      <Button onPress={handleSubmit} loading={isLoading} disabled={!canSubmit}>
        <Text>Reset password</Text>
      </Button>
    </AuthScreen>
  )
}
