import { useRef } from "react"
import { View } from "react-native"
import { Stack } from "expo-router"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useModalA11y } from "@/hooks/useModalA11y"

export default function ModalsLayout() {
  const isDesktop = useIsDesktop()
  const containerRef = useRef(null)
  useModalA11y(containerRef)

  const stack = (
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
  )

  return (
    // Phones: modals present full-screen. Desktop: a normal centered dialog
    // on the same light page tone as the sign-in screen (the tab page
    // isn't rendered behind a modal route, so a dimmed overlay would
    // just be flat grey).
    <View className="flex-1 bg-background md:items-center md:justify-center md:bg-secondary/50">
      <View
        ref={containerRef}
        // role/aria-modal aren't in RN's View prop types but are real,
        // supported pass-through props on react-native-web — no-ops on
        // native. Paired with useModalA11y's focus trap + Escape-to-close.
        {...({ role: "dialog", "aria-modal": true } as any)}
        className={isDesktop ? "h-[82vh] max-h-[760px] w-[560px] overflow-hidden rounded-xl border border-border bg-background" : "flex-1"}
      >
        {stack}
      </View>
    </View>
  )
}
