import { Tabs } from "expo-router"
import { Platform, View, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useColorScheme } from "nativewind"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Colors } from "@/constants/colors"
import { Sidebar } from "@/components/shared/Sidebar"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { useIsDesktop } from "@/hooks/useIsDesktop"

const TAB_BAR_HEIGHT = 64
const TAB_BAR_SIDE_MARGIN = 16
const TAB_BAR_RADIUS = 32

export default function TabsLayout() {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktop()

  return (
    // Desktop nav moves to a Sidebar (X/Instagram-style) instead of the
    // floating bottom bar, and content is capped to a comfortable dashboard
    // width rather than stretching across the whole window — the row is
    // centered as a [sidebar + content] group so it doesn't hug the left
    // edge on very wide screens. The column is wide enough for real
    // multi-column page layouts (dashboard sidebar, budget grid, etc.), not
    // just a single narrow reading line — it scales up gradually across
    // breakpoints instead of freezing at one fixed width, up through a 3xl
    // (1920px) step for large monitors/TVs. Past that point the shell still
    // stops growing on purpose — an infinitely wide page would just be
    // unreadable — but the ambient glow behind it (gated to desktop only, so
    // the phone app never sees it) now spans the full window instead of
    // stopping at the shell's own edge, so the surrounding space reads as a
    // designed background rather than a dead void the app is floating in.
    <View className="flex-1 flex-row relative md:justify-center md:bg-white md:dark:bg-black">
      {isDesktop && <GlowBackground />}
      {isDesktop && <Sidebar />}
      <View className="flex-1 lg:flex-none lg:w-[820px] xl:w-[1000px] 2xl:w-[1160px] 3xl:w-[1320px]">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: isDark ? "#a5b4fc" : Colors.primary[600],
            tabBarInactiveTintColor: isDark ? "#9ca3af" : Colors.muted,
            tabBarBackground: () => (
              <BlurView
                intensity={isDark ? 40 : 14}
                tint={isDark ? "dark" : "light"}
                style={{ flex: 1, borderRadius: TAB_BAR_RADIUS, overflow: "hidden" }}
              >
                {isDark && (
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: "rgba(99,102,241,0.12)"
                    }}
                  />
                )}
              </BlurView>
            ),
            tabBarStyle: {
              display: isDesktop ? "none" : "flex",
              position: "absolute",
              left: TAB_BAR_SIDE_MARGIN,
              right: TAB_BAR_SIDE_MARGIN,
              bottom: insets.bottom + 16,
              height: TAB_BAR_HEIGHT,
              borderRadius: TAB_BAR_RADIUS,
              borderTopWidth: 0,
              borderWidth: 1,
              borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
              paddingBottom: 0,
              paddingTop: 8,
              overflow: "hidden",
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.5 : 0.12,
                  shadowRadius: 16
                },
                android: {
                  elevation: 12
                }
              })
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "500"
            }
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
              )
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: "Transactions",
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? "receipt" : "receipt-outline"} size={size} color={color} />
              )
            }}
          />
          <Tabs.Screen
            name="budget"
            options={{
              title: "Budget",
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? "wallet" : "wallet-outline"} size={size} color={color} />
              )
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: "Insights",
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={size} color={color} />
              )
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
              )
            }}
          />
        </Tabs>
      </View>
    </View>
  )
}
