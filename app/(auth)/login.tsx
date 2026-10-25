import { View, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useState, useEffect } from "react"
import { storage as SecureStore } from "@/utils/storage"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { classifyIdentifier } from "@/utils/identifier"
import { useGoogleAuth } from "@/hooks/useGoogleAuth"
import { useTheme } from "@/lib/theme"
import { AuthScreen } from "@/components/layout/AuthScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field, Label, Separator } from "@/components/ui/misc"

export default function LoginScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [password, setPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth()
  const { colors } = useTheme()

  const clearOldTokens = async () => {
    try {
      await SecureStore.deleteItemAsync("access_token")
      await SecureStore.deleteItemAsync("user")
    } catch {
      console.log("Failed to clear old tokens")
    }
  }

  useEffect(() => {
    clearOldTokens()
  }, [])

  const { kind, value, isValid } = classifyIdentifier(identifierInput)
  const identifierError =
    identifierInput.trim().length > 0 && !isValid
      ? kind === "email" ? "Please enter a valid email address" : "Please enter a valid 10-digit phone number"
      : undefined

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle()
    if (result.success) {
      router.replace("/(tabs)")
    } else if (result.error) {
      showAlert("Google sign-in failed", result.error)
    }
  }

  const handleLogin = async () => {
    if (!identifierInput.trim()) {
      showAlert("Error", "Please enter a phone number or email")
      return
    }
    if (!isValid) {
      showAlert("Invalid input", identifierError ?? "Please check your phone number or email")
      return
    }
    if (!password) {
      showAlert("Error", "Please enter your password")
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.login({ identifier: value, password })
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { pendingToken: response.pending_token, emailHint: response.email_hint }
      })
    } catch (error: any) {
      // The backend deliberately returns the same 401 + message whether the
      // identifier is unknown or the password is wrong (avoids leaking
      // whether a phone/email owns an account) — so there's no "offer to
      // sign up" branch here; just show the generic failure.
      showAlert("Sign in failed", extractErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = isValid && !!password && !isLoading

  return (
    <AuthScreen
      title="Log in"
      subtitle="Welcome back. Sign in to your account."
      footer={
        <>
          <View className="flex-row items-center justify-center">
            <Text className="text-sm text-muted-foreground">Don&apos;t have an account? </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(auth)/signup", params: { identifier: identifierInput } })}
              disabled={isLoading}
              accessibilityRole="link"
              hitSlop={8}
              className="web:cursor-pointer"
            >
              <Text className="text-sm font-medium underline">Sign up</Text>
            </Pressable>
          </View>
          <Text className="text-center text-xs leading-5 text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </>
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
          autoComplete="username"
          textContentType="username"
          editable={!isLoading}
          invalid={!!identifierError}
          returnKeyType="next"
        />
      </Field>

      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Label>Password</Label>
          <Pressable
            onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { identifier: identifierInput } })}
            disabled={isLoading}
            accessibilityRole="link"
            hitSlop={8}
            className="web:cursor-pointer"
          >
            <Text className="text-[13px] text-muted-foreground underline">Forgot password?</Text>
          </Pressable>
        </View>
        <Input
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          editable={!isLoading}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && handleLogin()}
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
      </View>

      <Button onPress={handleLogin} loading={isLoading} disabled={!canSubmit} className="mt-2">
        <Text>Log in</Text>
      </Button>

      <View className="flex-row items-center gap-3">
        <Separator className="flex-1" />
        <Text className="text-xs text-muted-foreground">or</Text>
        <Separator className="flex-1" />
      </View>

      <Button variant="outline" onPress={handleGoogleSignIn} loading={isGoogleLoading} disabled={isLoading}>
        <Ionicons name="logo-google" size={15} color={colors.foreground} />
        <Text>Continue with Google</Text>
      </Button>
    </AuthScreen>
  )
}
