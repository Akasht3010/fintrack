import { View } from "react-native"
import { Stack } from "expo-router"
import Animated from "react-native-reanimated"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation"

export default function AuthLayout() {
  const isDesktop = useIsDesktop()
  const animatedStyle = useEntranceAnimation(300)

  return (
    // Auth screens are short, single-purpose forms — exactly what a centered
    // card suits (this is how X and Instagram present sign-in on desktop
    // too). Below the `md` breakpoint this is a no-op, so phones and the
    // native app render full-bleed as before. The desktop-only glow behind
    // the card (see app/(tabs)/_layout.tsx for the same treatment) keeps the
    // backdrop from reading as a flat dead void around the card.
    <View className="flex-1 bg-white dark:bg-neutral-950 relative md:items-center md:justify-center md:bg-neutral-100 md:dark:bg-black">
      {isDesktop && <GlowBackground />}
      {/* NativeWind doesn't patch Animated.View for className support, so the
          card's actual sizing/shape stays on a plain (NativeWind-aware) View
          nested inside a bare, style-only Animated.View that just handles
          the entrance animation. This drives that animation by hand (see
          useEntranceAnimation) rather than via Reanimated's `entering` prop
          — `entering` keeps the element `position: absolute` on web for the
          transition, which fights the alignItems/justifyContent centering
          below and was the suspected cause of the card drifting off-center
          on some window sizes. */}
      <Animated.View
        style={[{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }, animatedStyle]}
      >
        <View className="flex-1 w-full md:flex-none md:h-[85vh] md:w-[calc(100%-160px)] md:max-w-[560px] md:rounded-[32px] md:border md:border-neutral-200 md:dark:border-neutral-800 md:shadow-2xl md:overflow-hidden">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="verify-otp" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="reset-password" />
          </Stack>
        </View>
      </Animated.View>
    </View>
  )
}
