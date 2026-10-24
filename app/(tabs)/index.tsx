import { View, ScrollView, Pressable, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { router, useFocusEffect } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { insightsApi } from "@/api/endpoints/insights"
import { formatCurrency } from "@/utils/currency"
import { formatDateShort } from "@/utils/date"
import { toDecimal } from "@/utils/money"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import { Badge, Separator, Skeleton } from "@/components/ui/misc"
import { FadeIn } from "@/components/effects/FadeIn"
import { MovingBorder } from "@/components/effects/MovingBorder"
import { NumberTicker } from "@/components/effects/NumberTicker"
import { Spotlight } from "@/components/effects/Spotlight"
import { useTabBarClearance } from "@/hooks/useTabBarClearance"
import { useCategoryIcons } from "@/hooks/useCategories"
import { useNetWorth } from "@/hooks/useAccounts"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { useCallback, useState, type ReactNode } from "react"
import type { Transaction } from "@/types/domain"

type IconName = keyof typeof Ionicons.glyphMap

const QUICK_ACTIONS: { label: string; icon: IconName; href: "/(modals)/add-expense" | "/budget" | "/insights" | "/(modals)/accounts" }[] = [
  { label: "Add", icon: "add", href: "/(modals)/add-expense" },
  { label: "Budgets", icon: "wallet-outline", href: "/budget" },
  { label: "Insights", icon: "pie-chart-outline", href: "/insights" },
  { label: "Accounts", icon: "card-outline", href: "/(modals)/accounts" }
]

function greeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

const signedCurrency = (n: number) => `${n >= 0 ? "+" : "−"}${formatCurrency(Math.abs(n))}`

export default function DashboardScreen() {
  const { user } = useUserStore()
  const [refreshing, setRefreshing] = useState(false)
  const tabBarClearance = useTabBarClearance()
  const CATEGORY_ICONS = useCategoryIcons()
  const { data: netWorth } = useNetWorth()
  const { colors } = useTheme()
  const isDesktop = useIsDesktop()

  const { data: transactions = [], isLoading, error, refetch } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async ({ signal }) => {
      const response = await transactionApi.list({ page: 1, limit: 20 }, signal)
      return response.transactions
    },
    enabled: !!user?.id
  })

  // The "This month" summary comes from /api/insights, not a client-side
  // sum of the recent-transactions list — that only saw the newest page and
  // couldn't match the Insights tab.
  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ["insights"],
    queryFn: ({ signal }) => insightsApi.summary(1, signal),
    enabled: !!user?.id
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
      refetchInsights()
    }, [refetch, refetchInsights])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    Promise.all([refetch(), refetchInsights()]).finally(() => setRefreshing(false))
  }, [refetch, refetchInsights])

  const totalSpent = insights?.monthly_totals.at(-1)?.total ?? 0
  const totalIncome = insights?.monthly_income_totals.at(-1)?.total ?? 0
  const net = totalIncome - totalSpent
  // Share of this month's income already spent; null when there's no
  // income yet, since "spent ∞% of ₹0" isn't a useful number to show.
  const spentRatio = totalIncome > 0 ? totalSpent / totalIncome : null
  const savingsRate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : null
  const topCategory = insights?.category_breakdown[0]
  const hasAccounts = !!netWorth && netWorth.accounts.length > 0

  const header = (
    <FadeIn>
      <View className="flex-row items-center justify-between px-6 pb-6 pt-4">
        <View className="flex-1">
          <Text className="text-sm text-muted-foreground">{greeting()},</Text>
          <Text numberOfLines={1} className="mt-0.5 text-3xl font-bold tracking-tight">
            {user?.name?.split(" ")[0] ?? "there"}
          </Text>
        </View>
        {!isDesktop && (
          <Button
            size="icon"
            className="rounded-full"
            onPress={() => router.push("/(modals)/add-expense")}
            accessibilityLabel="Add transaction"
          >
            <Ionicons name="add" size={22} color={colors.primaryForeground} />
          </Button>
        )}
      </View>
    </FadeIn>
  )

  const heroCard = (
    <FadeIn delay={60}>
      <MovingBorder radius={24}>
        <View className="p-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-muted-foreground">Net cash flow</Text>
            <Badge variant={net >= 0 ? "positive" : "negative"}>
              <Text>This month</Text>
            </Badge>
          </View>

          {insightsLoading ? (
            <Skeleton className="mt-3 h-11 w-48 rounded-lg" />
          ) : (
            <NumberTicker
              value={net}
              format={signedCurrency}
              className={cn("mt-2 text-4xl font-bold tracking-tighter", net >= 0 ? "text-foreground" : "text-negative")}
            />
          )}

          <View className="mt-6 flex-row gap-3">
            {[
              { label: "Income", amount: totalIncome, icon: "arrow-down" as const, color: colors.positive, tint: "bg-positive/15" },
              { label: "Spent", amount: totalSpent, icon: "arrow-up" as const, color: colors.negative, tint: "bg-negative/15" }
            ].map((item) => (
              <View key={item.label} className="flex-1 rounded-xl bg-secondary/60 p-3">
                <View className="flex-row items-center gap-2">
                  <View className={cn("h-6 w-6 items-center justify-center rounded-md", item.tint)}>
                    <Ionicons name={item.icon} size={13} color={item.color} />
                  </View>
                  <Text className="text-xs text-muted-foreground">{item.label}</Text>
                </View>
                <Text numberOfLines={1} className="mt-2 text-base font-semibold md:text-lg">
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
          </View>

          {spentRatio !== null && (
            <View className="mt-5">
              <View className="h-2 overflow-hidden rounded-full bg-secondary">
                <View
                  className={cn("h-full rounded-full", spentRatio > 1 ? "bg-negative" : "bg-primary")}
                  style={{ width: `${Math.min(100, Math.round(spentRatio * 100))}%` }}
                />
              </View>
              <Text className="mt-2 text-xs text-muted-foreground">
                {spentRatio > 1
                  ? `You've spent ${Math.round((spentRatio - 1) * 100)}% more than you earned`
                  : `${Math.round(spentRatio * 100)}% of income spent`}
              </Text>
            </View>
          )}
        </View>
      </MovingBorder>
    </FadeIn>
  )

  const quickActions = (
    <FadeIn delay={120}>
      <View className="flex-row gap-3">
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.href)}
            accessibilityRole="button"
            className="flex-1 items-center gap-2 rounded-2xl border border-border bg-card py-3.5 active:opacity-80 web:cursor-pointer web:transition-colors web:hover:bg-accent/60"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name={action.icon} size={18} color={colors.primary} />
            </View>
            <Text className="text-xs font-medium">{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </FadeIn>
  )

  const statCard = (props: { label: string; icon: IconName; value: ReactNode; hint?: string; onPress?: () => void }) => {
    const body = (
      <>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-muted-foreground">{props.label}</Text>
          <Ionicons name={props.icon} size={16} color={colors.mutedForeground} />
        </View>
        <View className="mt-3">{props.value}</View>
        {props.hint && <Text className="mt-1 text-xs text-muted-foreground">{props.hint}</Text>}
      </>
    )
    return props.onPress ? (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        className="flex-1 rounded-2xl border border-border bg-card p-5 shadow-sm shadow-black/5 active:opacity-80 web:cursor-pointer web:transition-colors web:hover:bg-accent/60"
      >
        {body}
      </Pressable>
    ) : (
      <Card className="flex-1 p-5">{body}</Card>
    )
  }

  const netWorthStat = statCard({
    label: "Net worth",
    icon: "card-outline",
    onPress: () => router.push("/(modals)/accounts"),
    value: hasAccounts ? (
      <NumberTicker
        value={toDecimal(netWorth.net_worth).toNumber()}
        format={formatCurrency}
        numberOfLines={1}
        className="text-xl font-bold tracking-tight md:text-2xl"
      />
    ) : (
      <Text className="text-sm font-medium text-primary">Add an account →</Text>
    ),
    hint: hasAccounts ? `${netWorth.accounts.length} account${netWorth.accounts.length === 1 ? "" : "s"}` : undefined
  })

  const savingsStat = statCard({
    label: "Savings rate",
    icon: "trending-up-outline",
    value: (
      <Text className={cn("text-xl font-bold tracking-tight md:text-2xl", savingsRate !== null && savingsRate < 0 && "text-negative")}>
        {savingsRate === null ? "—" : `${savingsRate}%`}
      </Text>
    ),
    hint: savingsRate === null ? "No income recorded yet" : "of this month's income"
  })

  const topCategoryStat = topCategory
    ? statCard({
        label: "Top category",
        icon: "flame-outline",
        onPress: () => router.push("/insights"),
        value: (
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">{CATEGORY_ICONS[topCategory.category] || "📌"}</Text>
            <Text numberOfLines={1} className="flex-1 text-lg font-semibold capitalize">{topCategory.category}</Text>
          </View>
        ),
        hint: `${formatCurrency(topCategory.total)} this month`
      })
    : null

  const recentCard = (
    <FadeIn delay={180}>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <View>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Your latest transactions</CardDescription>
          </View>
          <Button variant="ghost" size="sm" onPress={() => router.push("/transactions")}>
            <Text>View all</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.foreground} />
          </Button>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          {isLoading && (
            <View className="gap-1 px-3 pb-3">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="flex-row items-center gap-3 py-2.5">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <View className="flex-1 gap-2">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </View>
                  <Skeleton className="h-4 w-16" />
                </View>
              ))}
            </View>
          )}

          {!isLoading && error && <ErrorState message="Failed to load transactions" onRetry={refetch} />}

          {!isLoading && !error && transactions.length === 0 && (
            <EmptyState
              icon="💸"
              title="No transactions yet"
              subtitle="Add your first expense to get started."
              actionLabel="Add expense"
              onAction={() => router.push("/(modals)/add-expense")}
            />
          )}

          {!isLoading && !error && transactions.length > 0 && (
            <View>
              {transactions.slice(0, 8).map((transaction: Transaction, i) => (
                <View key={transaction.id}>
                  {i > 0 && <Separator className="ml-[68px] w-auto" />}
                  <Pressable
                    onPress={() => router.push({ pathname: "/(modals)/transaction-detail", params: { id: transaction.id } })}
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-accent web:cursor-pointer web:transition-colors web:hover:bg-accent/60"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary">
                      <Text className="text-lg">{CATEGORY_ICONS[transaction.category] || "📌"}</Text>
                    </View>
                    <View className="flex-1">
                      <Text numberOfLines={1} className="text-sm font-semibold">{transaction.merchant}</Text>
                      <Text numberOfLines={1} className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {transaction.category} · {formatDateShort(transaction.date)}
                      </Text>
                    </View>
                    <Text className={cn("text-sm font-semibold", transaction.type === "debit" ? "text-foreground" : "text-positive")}>
                      {transaction.type === "debit" ? "−" : "+"}
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarClearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}
      >
        <View className="absolute left-0 right-0 top-0 h-[520px]">
          <Spotlight />
        </View>

        {header}

        {isDesktop ? (
          // Desktop: money front and center on the left, at-a-glance figures
          // in a narrower right rail.
          <View className="flex-row items-start gap-6 px-6">
            <View className="flex-1 gap-6">
              {heroCard}
              {recentCard}
            </View>
            <FadeIn delay={120} style={{ width: 300, flexShrink: 0 }}>
              <View className="gap-4">
                {netWorthStat}
                {savingsStat}
                {topCategoryStat}
              </View>
            </FadeIn>
          </View>
        ) : (
          <View className="gap-5 px-5">
            {heroCard}
            {quickActions}
            <FadeIn delay={150}>
              <View className="gap-3">
                {netWorthStat}
                <View className="flex-row gap-3">
                  {savingsStat}
                  {topCategoryStat}
                </View>
              </View>
            </FadeIn>
            {recentCard}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
