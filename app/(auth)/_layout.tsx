import { View } from "react-native"
import { Stack } from "expo-router"
import Animated from "react-native-reanimated"
import { AuthBackdrop } from "@/components/effects/AuthBackdrop"
import { AuthBrandPanel } from "@/components/shared/AuthBrandPanel"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation"

export default function AuthLayout() {
  const isDesktop = useIsDesktop()
  const animatedStyle = useEntranceAnimation(400, 0.98)

  // NativeWind doesn't patch Animated.View for className support, so the
  // card's sizing/shape stays on a plain View nested inside a style-only
  // Animated.View that just handles the entrance animation.
  //
  // On desktop the grid + spotlight frame the opaque card from out here.
  // Phones have no card, and stack scenes paint an opaque background over
  // anything behind them, so screens there draw <AuthBackdrop /> themselves.
  const card = (
    <View className="w-full flex-1 md:h-[86vh] md:max-h-[760px] md:w-[440px] md:flex-none md:overflow-hidden md:rounded-3xl md:border md:border-border md:bg-card md:shadow-2xl md:shadow-black/10">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify-otp" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </View>
  )

  return (
    <View className="relative flex-1 bg-background">
      {isDesktop && <AuthBackdrop />}
      <Animated.View style={[{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }, animatedStyle]}>
        {isDesktop ? (
          <View className="mx-auto w-full max-w-[1160px] flex-1 flex-row items-center justify-center gap-16 px-10">
            <AuthBrandPanel />
            {card}
          </View>
        ) : (
          card
        )}
      </Animated.View>
    </View>
  )
}
