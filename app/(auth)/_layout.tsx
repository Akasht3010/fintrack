import { View } from "react-native"
import { Stack } from "expo-router"
import Animated from "react-native-reanimated"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { AuthBrandPanel } from "@/components/shared/AuthBrandPanel"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation"

export default function AuthLayout() {
  const isDesktop = useIsDesktop()
  const animatedStyle = useEntranceAnimation(300)

  // NativeWind doesn't patch Animated.View for className support, so the
  // card's actual sizing/shape stays on a plain (NativeWind-aware) View
  // nested inside a bare, style-only Animated.View that just handles the
  // entrance animation (see below). Fixed desktop width rather than the
  // old calc()-from-viewport one — it now sits next to AuthBrandPanel
  // inside a centered row instead of being the only thing on screen, so
  // its width no longer needs to account for the whole window's margins.
  const card = (
    <View className="flex-1 w-full md:flex-none md:h-[85vh] md:w-[460px] md:rounded-[32px] md:border md:border-neutral-200 md:dark:border-neutral-800 md:shadow-2xl md:overflow-hidden">
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
    // Auth screens are short, single-purpose forms — exactly what a centered
    // card suits (this is how X and Instagram present sign-in on desktop
    // too). Below the `md` breakpoint this is a no-op, so phones and the
    // native app render full-bleed as before. At desktop width the card no
    // longer floats alone in the middle of a mostly-empty window — it sits
    // beside AuthBrandPanel, which gives the rest of the space real content
    // (brand mark, headline, the same pitch as the marketing site) instead
    // of just ambient glow.
    <View className="flex-1 bg-white dark:bg-neutral-950 relative md:items-center md:justify-center md:bg-neutral-100 md:dark:bg-black">
      {isDesktop && <GlowBackground />}
      <Animated.View
        style={[{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }, animatedStyle]}
      >
        {isDesktop ? (
          <View className="flex-1 w-full flex-row items-center justify-center gap-20 px-10 max-w-[1160px] mx-auto">
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
