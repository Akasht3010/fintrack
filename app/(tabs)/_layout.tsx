import { Tabs } from "expo-router"
import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { TopNav, NAV_ITEMS } from "@/components/shared/TopNav"
import { useIsDesktop } from "@/hooks/useIsDesktop"

const TAB_ROUTES = ["index", "transactions", "budget", "insights", "profile"] as const

export default function TabsLayout() {
  const { colors } = useTheme()
  const isDesktop = useIsDesktop()
  const insets = useSafeAreaInsets()

  return (
    // Desktop/web: a normal website layout — top nav bar, page content below
    // (each page centers its own column). Phones: a standard bottom tab bar.
    <View className="flex-1 bg-background">
      {isDesktop && <TopNav />}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarStyle: {
            display: isDesktop ? "none" : "flex",
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            // Explicit so the label never clips: the icon slot flexes to fill
            // the item and the label only gets what's left, which at the
            // 48px web default was ~7px (labels cut in half).
            height: 62 + insets.bottom,
            paddingTop: 4,
            paddingBottom: insets.bottom + 4,
            elevation: 0,
            shadowOpacity: 0
          },
          tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter_500Medium" }
        }}
      >
        {TAB_ROUTES.map((name, i) => {
          const item = NAV_ITEMS[i]
          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: name === "index" ? "Home" : item.label,
                tabBarIcon: ({ color, focused }) => (
                  <Ionicons name={focused ? item.activeIcon : item.icon} size={22} color={color} />
                )
              }}
            />
          )
        })}
      </Tabs>
    </View>
  )
}
