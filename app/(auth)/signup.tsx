import { View, Pressable } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { classifyIdentifier, isValidEmail, isValidPhone } from "@/utils/identifier"
import { useGoogleAuth } from "@/hooks/useGoogleAuth"
import { confirm } from "@/utils/confirm"
import { showAlert } from "@/utils/alert"
import { useTheme } from "@/lib/theme"
import { AuthScreen } from "@/components/layout/AuthScreen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field, Separator } from "@/components/ui/misc"

const MIN_PASSWORD_LENGTH = 8

export default function SignupScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>()
  const prefill = classifyIdentifier(params.identifier ?? "")
  const { colors } = useTheme()

  const [name, setName] = useState("")
  const [email, setEmail] = useState(prefill.kind === "email" ? prefill.value : "")
  const [phone, setPhone] = useState(prefill.kind === "phone" ? prefill.value : "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn: signInWithGoogle, isLoading: isGoogleLoading } = useGoogleAuth()

  const isNameValid = name.trim().length > 0
  const isEmailValid = isValidEmail(email)
  const isPhoneValid = isValidPhone(phone)
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH
  const doPasswordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit = isNameValid && isEmailValid && isPhoneValid && isPasswordValid && doPasswordsMatch

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle()
    if (result.success) {
      router.replace("/(tabs)")
    } else if (result.error) {
      showAlert("Google sign-in failed", result.error)
    }
  }

  const handleSignup = async () => {
    if (!isNameValid) {
      showAlert("Error", "Please enter your name")
      return
    }
    if (!isEmailValid) {
      showAlert("Invalid email", "Please enter a valid email address")
      return
    }
    if (!isPhoneValid) {
      showAlert("Invalid phone", "Please enter a valid 10-digit phone number")
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
      const response = await authApi.signup({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ""),
        password,
        confirmPassword
      })

      // Signup emails a code instead of returning a session — the account
      // only becomes usable once the address is proven, same as login.
      // replace, not push: going "back" would resubmit into a 409.
      router.replace({
        pathname: "/(auth)/verify-otp",
        params: { pendingToken: response.pending_token, emailHint: response.email_hint }
      })
    } catch (error: any) {
      if (error.response?.status === 409) {
        const goToLogin = await confirm(
          "Account already exists",
          extractErrorMessage(error, "This email or phone number is already registered."),
          { confirmLabel: "Log in" }
        )
        if (goToLogin) {
          router.replace({ pathname: "/(auth)/login", params: { identifier: email.trim() } })
        }
      } else {
        showAlert("Sign up failed", extractErrorMessage(error))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const eye = (
    <Pressable
      onPress={() => setIsPasswordVisible(v => !v)}
      accessibilityRole="button"
      accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
      hitSlop={10}
      className="web:cursor-pointer"
    >
      <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={17} color={colors.mutedForeground} />
    </Pressable>
  )

  return (
    <AuthScreen
      title="Create an account"
      subtitle="Track every expense in one place."
      footer={
        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-muted-foreground">Already have an account? </Text>
          <Pressable
            onPress={() => router.replace({ pathname: "/(auth)/login", params: { identifier: email || phone } })}
            disabled={isLoading}
            accessibilityRole="link"
            hitSlop={8}
            className="web:cursor-pointer"
          >
            <Text className="text-sm font-medium underline">Log in</Text>
          </Pressable>
        </View>
      }
    >
      <Field label="Full name">
        <Input accessibilityLabel="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" editable={!isLoading} />
      </Field>
      <Field label="Email" error={email.trim().length > 0 && !isEmailValid && "Please enter a valid email address"}>
        <Input
          accessibilityLabel="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!isLoading}
          invalid={email.trim().length > 0 && !isEmailValid}
        />
      </Field>
      <Field label="Phone" error={phone.trim().length > 0 && !isPhoneValid && "Please enter a valid 10-digit phone number"}>
        <Input
          accessibilityLabel="Phone"
          placeholder="10-digit mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          editable={!isLoading}
          invalid={phone.trim().length > 0 && !isPhoneValid}
        />
      </Field>
      <Field
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        error={password.length > 0 && !isPasswordValid && `Password must be at least ${MIN_PASSWORD_LENGTH} characters`}
      >
        <Input
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!isLoading}
          invalid={password.length > 0 && !isPasswordValid}
          trailing={eye}
        />
      </Field>
      <Field label="Confirm password" error={confirmPassword.length > 0 && !doPasswordsMatch && "Passwords don't match"}>
        <Input
          accessibilityLabel="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
          invalid={confirmPassword.length > 0 && !doPasswordsMatch}
        />
      </Field>

      <Button onPress={handleSignup} loading={isLoading} disabled={!canSubmit} className="mt-2">
        <Text>Create account</Text>
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
