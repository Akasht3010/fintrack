import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { classifyIdentifier } from "@/utils/identifier"
import { AuthScreen } from "@/components/layout/AuthScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field } from "@/components/ui/misc"

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [isLoading, setIsLoading] = useState(false)

  const { kind, value, isValid } = classifyIdentifier(identifierInput)
  const identifierError =
    identifierInput.trim().length > 0 && !isValid
      ? kind === "email" ? "Please enter a valid email address" : "Please enter a valid 10-digit phone number"
      : undefined

  const handleSubmit = async () => {
    if (!identifierInput.trim()) {
      showAlert("Error", "Please enter a phone number or email")
      return
    }
    if (!isValid) {
      showAlert("Invalid input", identifierError ?? "Please check your phone number or email")
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
      // The backend always returns the same shape here regardless of whether
      // the identifier matches an account, so there's no "no account found"
      // branch — an unknown identifier is indistinguishable from a real one
      // that just got a code emailed to it.
      showAlert("Couldn't send code", extractErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthScreen
      title="Reset your password"
      subtitle="Enter your email or phone number and we'll email you a verification code."
      footer={
        <Button variant="ghost" onPress={() => router.back()} disabled={isLoading}>
          <Text className="text-muted-foreground">Back to log in</Text>
        </Button>
      }
    >
      <Field label="Email or phone" error={identifierError}>
        <Input
          accessibilityLabel="Email or phone"
          placeholder="you@example.com"
          value={identifierInput}
          onChangeText={setIdentifierInput}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          autoFocus
          invalid={!!identifierError}
          onSubmitEditing={() => isValid && handleSubmit()}
        />
      </Field>
      <Button onPress={handleSubmit} loading={isLoading} disabled={!isValid}>
        <Text>Send code</Text>
      </Button>
    </AuthScreen>
  )
}
