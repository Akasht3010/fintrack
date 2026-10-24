import { Tabs } from "expo-router"
import { Platform, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { Sidebar, NAV_ITEMS } from "@/components/shared/Sidebar"
import { useIsDesktop } from "@/hooks/useIsDesktop"

// Must match useTabBarClearance (height + bottom gap) so scroll content
// always clears the floating bar.
const TAB_BAR_HEIGHT = 64
const TAB_BAR_SIDE_MARGIN = 16
const TAB_BAR_RADIUS = 24

const TAB_ROUTES = ["index", "transactions", "budget", "insights", "profile"] as const

export default function TabsLayout() {
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const isDesktop = useIsDesktop()

  return (
    // Desktop: sidebar + a content column capped to a comfortable dashboard
    // width that still scales up through the 3xl (1920px) breakpoint; the
    // [sidebar + content] group is centered so it doesn't hug the left edge
    // on very wide screens. Mobile: full-bleed content + floating tab bar.
    <View className="flex-1 flex-row bg-background md:justify-center">
      {isDesktop && <Sidebar />}
      <View className="flex-1 lg:flex-none lg:w-[820px] xl:w-[1000px] 2xl:w-[1160px] 3xl:w-[1320px]">
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.background },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.mutedForeground,
            tabBarBackground: () => (
              <View style={{ flex: 1, borderRadius: TAB_BAR_RADIUS, overflow: "hidden", backgroundColor: colors.card }} />
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
              borderColor: colors.border,
              paddingBottom: 0,
              paddingTop: 8,
              overflow: "hidden",
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.5 : 0.08,
                  shadowRadius: 20
                },
                android: { elevation: 10 },
                default: { boxShadow: isDark ? "0 8px 30px rgba(0,0,0,0.5)" : "0 8px 30px rgba(9,9,11,0.08)" }
              })
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontFamily: "Inter_500Medium"
            }
          }}
        >
          {TAB_ROUTES.map((name, i) => {
            const item = NAV_ITEMS[i]
            return (
              <Tabs.Screen
                key={name}
                name={name}
                options={{
                  // "Overview" is too long for a five-up bar on a ~360px phone.
                  title: name === "index" ? "Home" : item.label,
                  tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                      name={focused ? item.activeIcon : item.icon}
                      size={22}
                      color={color}
                    />
                  )
                }}
              />
            )
          })}
        </Tabs>
      </View>
    </View>
  )
}
