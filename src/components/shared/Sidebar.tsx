import { View, Pressable } from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useUserStore } from "@/store/useUserStore"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { Separator } from "@/components/ui/misc"
import { BrandMark } from "./BrandMark"

type NavItem = {
  href: "/" | "/transactions" | "/budget" | "/insights" | "/profile"
  label: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: "grid-outline", activeIcon: "grid" },
  { href: "/transactions", label: "Transactions", icon: "receipt-outline", activeIcon: "receipt" },
  { href: "/budget", label: "Budgets", icon: "wallet-outline", activeIcon: "wallet" },
  { href: "/insights", label: "Insights", icon: "pie-chart-outline", activeIcon: "pie-chart" },
  { href: "/profile", label: "Profile", icon: "person-circle-outline", activeIcon: "person-circle" }
]

export function initialsFor(name?: string): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("")
}

// Desktop-only left nav (see app/(tabs)/_layout.tsx, which renders this
// instead of the floating bottom tab bar at the `md` breakpoint), laid out
// like shadcn/ui's sidebar block: brand, grouped nav, primary action, and
// the signed-in user pinned to the bottom.
export function Sidebar() {
  const pathname = usePathname()
  const user = useUserStore(state => state.user)
  const { colors } = useTheme()

  return (
    <View className="h-full w-64 shrink-0 justify-between border-r border-border bg-background px-3 py-5 2xl:w-72">
      <View>
        <Pressable
          onPress={() => router.push("/")}
          accessibilityRole="link"
          className="mb-6 flex-row items-center gap-2.5 rounded-lg px-2 py-1.5 web:cursor-pointer"
        >
          <BrandMark size={30} />
          <Text className="text-lg font-semibold tracking-tight">Fintrack</Text>
        </Pressable>

        <Button onPress={() => router.push("/(modals)/add-expense")} size="sm" className="mb-6 h-10">
          <Ionicons name="add" size={18} color={colors.primaryForeground} />
          <Text>New transaction</Text>
        </Button>

        <Text className="mb-2 px-2 text-xs font-medium text-muted-foreground">Menu</Text>
        <View className="gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href)}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive }}
                className={cn(
                  "h-10 flex-row items-center gap-3 rounded-lg px-2.5 web:cursor-pointer web:transition-colors web:duration-150",
                  isActive ? "bg-secondary" : "web:hover:bg-secondary/60"
                )}
              >
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.mutedForeground}
                />
                <Text className={cn("text-sm", isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View>
        <Separator className="mb-3" />
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="link"
          className="flex-row items-center gap-3 rounded-lg px-2 py-2 web:cursor-pointer web:hover:bg-secondary/60"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/15">
            <Text className="text-sm font-semibold text-primary">{initialsFor(user?.name)}</Text>
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} className="text-sm font-semibold">
              {user?.name ?? "User"}
            </Text>
            <Text numberOfLines={1} className="text-xs text-muted-foreground">
              {user?.email}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  )
}
