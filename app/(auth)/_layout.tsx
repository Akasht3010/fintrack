import { View } from "react-native"
import { Stack } from "expo-router"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { BrandMark } from "@/components/shared/BrandMark"
import { Text } from "@/components/ui/text"

export default function AuthLayout() {
  const isDesktop = useIsDesktop()

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  )

  if (!isDesktop) return <View className="flex-1 bg-background">{stack}</View>

  // Desktop: the form sits in a plain bordered card, centered on a light
  // grey page with the wordmark above it — a normal sign-in page.
  return (
    <View className="flex-1 items-center justify-center bg-secondary/50 px-6">
      <View className="mb-6 flex-row items-center gap-2">
        <BrandMark size={26} />
        <Text className="text-base font-semibold tracking-tight">Fintrack</Text>
      </View>
      <View className="h-[640px] max-h-[86vh] w-[420px] overflow-hidden rounded-xl border border-border bg-background">
        {stack}
      </View>
    </View>
  )
}
