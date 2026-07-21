import { Stack } from "expo-router"
import { useColorScheme } from "nativewind"

export default function AuthLayout() {
  const { colorScheme } = useColorScheme()
  const backgroundColor = colorScheme === "dark" ? "#0a0a0a" : "#ffffff"

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  )
}
