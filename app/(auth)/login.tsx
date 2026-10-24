import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { storage as SecureStore } from "@/utils/storage"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { useState, useEffect } from "react"
import { classifyIdentifier } from "@/utils/identifier"
import { useGoogleAuth } from "@/hooks/useGoogleAuth"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useTheme } from "@/lib/theme"
import { BrandMark } from "@/components/shared/BrandMark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Label, Separator } from "@/components/ui/misc"
import { FadeIn } from "@/components/effects/FadeIn"
import { AuthBackdrop } from "@/components/effects/AuthBackdrop"

export default function LoginScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const [identifierInput, setIdentifierInput] = useState(params.identifier ?? "")
  const [password, setPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth()
  const isDesktop = useIsDesktop()
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
  const showIdentifierError = identifierInput.trim().length > 0 && !isValid

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
      showAlert(
        "Invalid input",
        kind === "email"
          ? "Please enter a valid email address"
          : "Please enter a valid 10-digit phone number"
      )
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
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background md:bg-card">
      <StatusBar style="auto" />
      {!isDesktop && <AuthBackdrop />}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-[400px] flex-1 justify-center self-center px-6 py-10 md:px-9">
            <FadeIn>
              {/* The desktop brand panel already carries the logo. */}
              {!isDesktop && (
                <View className="mb-8 items-center">
                  <BrandMark size={56} />
                </View>
              )}
              <Text className="text-center text-2xl font-bold tracking-tight">Welcome back</Text>
              <Text className="mt-2 text-center text-sm text-muted-foreground">
                Enter your email or phone number to continue
              </Text>
            </FadeIn>

            <FadeIn delay={90} style={{ marginTop: 32 }}>
              <View className="gap-5">
                <View className="gap-2">
                  <Label nativeID="identifierLabel">Email or phone</Label>
                  <Input
                    accessibilityLabelledBy="identifierLabel"
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
                    invalid={showIdentifierError}
                    returnKeyType="next"
                    leading={<Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />}
                  />
                  {showIdentifierError && (
                    <Text className="text-xs text-destructive">
                      {kind === "email"
                        ? "Please enter a valid email address"
                        : "Please enter a valid 10-digit phone number"}
                    </Text>
                  )}
                </View>

                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Label nativeID="passwordLabel">Password</Label>
                    <Pressable
                      onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { identifier: identifierInput } })}
                      disabled={isLoading}
                      accessibilityRole="link"
                      hitSlop={8}
                      className="web:cursor-pointer"
                    >
                      <Text className="text-sm font-medium text-primary web:hover:underline">Forgot password?</Text>
                    </Pressable>
                  </View>
                  <Input
                    accessibilityLabelledBy="passwordLabel"
                    accessibilityLabel="Password"
                    placeholder="••••••••"
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
                    leading={<Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />}
                    trailing={
                      <Pressable
                        onPress={() => setIsPasswordVisible(v => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
                        hitSlop={10}
                        className="web:cursor-pointer"
                      >
                        <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
                      </Pressable>
                    }
                  />
                </View>

                <Button onPress={handleLogin} loading={isLoading} disabled={!canSubmit} className="mt-1">
                  <Text>Log in</Text>
                </Button>

                <View className="flex-row items-center gap-3">
                  <Separator className="flex-1" />
                  <Text className="text-xs uppercase tracking-wider text-muted-foreground">Or continue with</Text>
                  <Separator className="flex-1" />
                </View>

                <Button
                  variant="outline"
                  onPress={handleGoogleSignIn}
                  loading={isGoogleLoading}
                  disabled={isLoading}
                >
                  <Ionicons name="logo-google" size={17} color={colors.foreground} />
                  <Text>Google</Text>
                </Button>
              </View>
            </FadeIn>

            <FadeIn delay={180} style={{ marginTop: 28 }}>
              <View className="flex-row items-center justify-center">
                <Text className="text-sm text-muted-foreground">Don&apos;t have an account? </Text>
                <Pressable
                  onPress={() => router.push({ pathname: "/(auth)/signup", params: { identifier: identifierInput } })}
                  disabled={isLoading}
                  accessibilityRole="link"
                  hitSlop={8}
                  className="web:cursor-pointer"
                >
                  <Text className="text-sm font-semibold text-primary web:hover:underline">Sign up</Text>
                </Pressable>
              </View>

              <Text className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                By continuing, you agree to our <Text className="text-xs text-foreground underline">Terms of Service</Text>
                {" "}and <Text className="text-xs text-foreground underline">Privacy Policy</Text>.
              </Text>
            </FadeIn>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
