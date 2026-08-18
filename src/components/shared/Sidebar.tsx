import { View, Text, TouchableOpacity } from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useColorScheme } from "nativewind"
import { useUserStore } from "@/store/useUserStore"

type NavItem = {
  href: "/" | "/transactions" | "/budget" | "/insights" | "/profile"
  label: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "home-outline", activeIcon: "home" },
  { href: "/transactions", label: "Transactions", icon: "receipt-outline", activeIcon: "receipt" },
  { href: "/budget", label: "Budget", icon: "wallet-outline", activeIcon: "wallet" },
  { href: "/insights", label: "Insights", icon: "stats-chart-outline", activeIcon: "stats-chart" },
  { href: "/profile", label: "Profile", icon: "person-circle-outline", activeIcon: "person-circle" }
]

function initialsFor(name?: string): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("")
}

// Desktop-only left nav (see app/(tabs)/_layout.tsx, which renders this
// instead of the floating bottom tab bar at the `md` breakpoint) — same five
// destinations, laid out the way X/Instagram put their tab bar in a sidebar
// on wide screens rather than stretching it across the whole window.
export function Sidebar() {
  const pathname = usePathname()
  const user = useUserStore(state => state.user)
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"

  return (
    <View className="w-64 2xl:w-72 3xl:w-80 shrink-0 h-full border-r border-neutral-200 dark:border-neutral-800 px-3 py-6 justify-between">
      <View>
        <TouchableOpacity
          onPress={() => router.push("/")}
          className="flex-row items-center gap-3 px-3 py-2 mb-6 rounded-full transition-colors duration-150 hover:bg-neutral-100 dark:hover:bg-white/5"
        >
          <View className="w-9 h-9 rounded-xl bg-primary-500 items-center justify-center">
            <Text className="text-lg">₹</Text>
          </View>
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">Fintrack</Text>
        </TouchableOpacity>

        <View className="gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <TouchableOpacity
                key={item.href}
                onPress={() => router.push(item.href)}
                className={`flex-row items-center gap-4 px-3 py-3 rounded-full transition-colors duration-200 ${
                  isActive
                    ? "bg-primary-50 dark:bg-white/10"
                    : "hover:bg-neutral-50 dark:hover:bg-white/5"
                }`}
              >
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={24}
                  color={isActive ? (isDark ? "#a5b4fc" : "#16a34a") : (isDark ? "#9ca3af" : "#6b7280")}
                />
                <Text
                  className={`text-base transition-colors duration-200 ${
                    isActive
                      ? "font-bold text-primary-600 dark:text-accent-400"
                      : "font-medium text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/(modals)/add-expense")}
          className="bg-primary-600 dark:bg-accent-600 rounded-full py-3.5 items-center mt-6 transition-all duration-150 hover:opacity-90 active:scale-95"
        >
          <Text className="text-white text-base font-bold">New Expense</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        className="flex-row items-center gap-3 px-3 py-2 rounded-full transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-white/5"
      >
        <View className="w-9 h-9 rounded-full bg-primary-500 dark:bg-accent-600 items-center justify-center">
          <Text className="text-white text-sm font-bold">{initialsFor(user?.name)}</Text>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-sm font-semibold text-neutral-900 dark:text-white">
            {user?.name ?? "User"}
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted dark:text-neutral-400">
            {user?.email}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}
