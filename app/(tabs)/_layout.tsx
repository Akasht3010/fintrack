import { Tabs } from "expo-router"
import { Platform } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { useColorScheme } from "nativewind"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Colors } from "@/constants/colors"

const TAB_BAR_HEIGHT = 64
const TAB_BAR_SIDE_MARGIN = 16
const TAB_BAR_RADIUS = 32

export default function TabsLayout() {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? Colors.primary[400] : Colors.primary[600],
        tabBarInactiveTintColor: isDark ? "#9ca3af" : Colors.muted,
        tabBarBackground: () => (
          <BlurView
            intensity={14}
            tint={isDark ? "dark" : "light"}
            style={{ flex: 1, borderRadius: TAB_BAR_RADIUS, overflow: "hidden" }}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          left: TAB_BAR_SIDE_MARGIN,
          right: TAB_BAR_SIDE_MARGIN,
          bottom: insets.bottom + 16,
          height: TAB_BAR_HEIGHT,
          borderRadius: TAB_BAR_RADIUS,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
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
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          )
        }}
      />
    </Tabs>
  )
}
