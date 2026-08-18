import { View } from "react-native"
import { Stack } from "expo-router"
import Animated from "react-native-reanimated"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useEntranceAnimation } from "@/hooks/useEntranceAnimation"

export default function ModalsLayout() {
  const isDesktop = useIsDesktop()
  const animatedStyle = useEntranceAnimation(200, 0.94)

  return (
    // Same idea as the (auth) card: below `md` this is a no-op and modals
    // present full-screen as they always have. At `md` and up they read as
    // a centered dialog instead of a full-bleed page — wider than the auth
    // card since forms like add-expense need room for a category grid. This
    // group remounts every time a modal opens, so the pop-in animation
    // below replays on each open rather than once per session — same for
    // the desktop-only glow behind it.
    <View className="flex-1 bg-white dark:bg-neutral-950 relative md:items-center md:justify-center md:bg-neutral-100 md:dark:bg-black">
      {isDesktop && <GlowBackground />}
      {/* See app/(auth)/_layout.tsx for why the animated wrapper is bare
          (style-only, driven by useEntranceAnimation rather than Reanimated's
          `entering` prop) with the actual card styling on a nested plain View. */}
      <Animated.View
        style={[{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }, animatedStyle]}
      >
        <View className="flex-1 w-full md:flex-none md:h-[85vh] md:w-[calc(100%-160px)] md:max-w-[640px] md:rounded-[28px] md:border md:border-neutral-200 md:dark:border-neutral-800 md:shadow-2xl md:overflow-hidden">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="transaction-detail" />
            <Stack.Screen name="add-expense" />
            <Stack.Screen name="add-budget" />
            <Stack.Screen name="recurring" />
            <Stack.Screen name="export" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="accounts" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="delete-account" />
          </Stack>
        </View>
      </Animated.View>
    </View>
  )
}
