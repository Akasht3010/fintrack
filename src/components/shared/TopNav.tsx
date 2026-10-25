import { View, Pressable } from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useUserStore } from "@/store/useUserStore"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { BrandMark } from "./BrandMark"

type NavHref = "/" | "/transactions" | "/budget" | "/insights" | "/profile"

export const NAV_ITEMS: { href: NavHref; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { href: "/", label: "Overview", icon: "home-outline", activeIcon: "home" },
  { href: "/transactions", label: "Transactions", icon: "list-outline", activeIcon: "list" },
  { href: "/budget", label: "Budgets", icon: "wallet-outline", activeIcon: "wallet" },
  { href: "/insights", label: "Insights", icon: "bar-chart-outline", activeIcon: "bar-chart" },
  { href: "/profile", label: "Settings", icon: "settings-outline", activeIcon: "settings" }
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

/**
 * Desktop/web navigation: a plain top bar like a normal website — wordmark,
 * page links, primary action, account. Phones use the bottom tab bar
 * instead (see app/(tabs)/_layout.tsx).
 */
export function TopNav() {
  const pathname = usePathname()
  const user = useUserStore(state => state.user)
  const { colors } = useTheme()

  return (
    <View className="h-14 border-b border-border bg-background">
      <View className="mx-auto h-full w-full max-w-[1080px] flex-row items-center px-8">
        <Pressable onPress={() => router.push("/")} accessibilityRole="link" className="mr-8 flex-row items-center gap-2 web:cursor-pointer">
          <BrandMark size={22} />
          <Text className="text-[15px] font-semibold tracking-tight">Fintrack</Text>
        </Pressable>

        <View className="flex-1 flex-row items-center gap-1">
          {NAV_ITEMS.filter(i => i.href !== "/profile").map((item) => {
            const isActive = pathname === item.href
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href)}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive }}
                className={cn(
                  "h-8 justify-center rounded-md px-3 web:cursor-pointer web:transition-colors",
                  isActive ? "bg-primary/10" : "web:hover:bg-accent/60"
                )}
              >
                <Text className={cn("text-sm", isActive ? "font-medium text-primary" : "text-muted-foreground")}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View className="flex-row items-center gap-3">
          <Button size="sm" onPress={() => router.push("/(modals)/add-expense")}>
            <Ionicons name="add" size={16} color={colors.primaryForeground} />
            <Text>Add transaction</Text>
          </Button>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="link"
            accessibilityLabel="Settings"
            className={cn(
              "h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary web:cursor-pointer",
              pathname === "/profile" && "border-primary"
            )}
          >
            <Text className="text-xs font-medium">{initialsFor(user?.name)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
