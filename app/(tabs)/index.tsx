import { View, Pressable, RefreshControl, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router, useFocusEffect } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import dayjs from "dayjs"
import { useUserStore } from "@/store/useUserStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { insightsApi } from "@/api/endpoints/insights"
import { formatCurrency } from "@/utils/currency"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useNetWorth } from "@/hooks/useAccounts"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Page, PageHeader } from "@/components/layout"
import { TransactionRow } from "@/components/layout/TransactionRow"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import type { Transaction } from "@/types/domain"

function Stat({ label, value, hint, onPress, tone }: { label: string; value: string; hint?: string; onPress?: () => void; tone?: "negative" }) {
  const body = (
    <>
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
      <Text numberOfLines={1} className={cn("mt-1.5 text-xl font-semibold tracking-tight md:text-2xl", tone === "negative" && "text-destructive")}>
        {value}
      </Text>
      {hint && <Text numberOfLines={1} className="mt-1 text-xs text-muted-foreground">{hint}</Text>}
    </>
  )
  const base = "min-w-[45%] flex-1 rounded-lg border border-border bg-card p-4 md:min-w-0"
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className={cn(base, "active:bg-accent web:cursor-pointer web:hover:bg-accent/60")}>
      {body}
    </Pressable>
  ) : (
    <View className={base}>{body}</View>
  )
}

export default function OverviewScreen() {
  const { user } = useUserStore()
  const [refreshing, setRefreshing] = useState(false)
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

  // The month summary comes from /api/insights, not a client-side sum of
  // the recent-transactions list — that only saw the newest page and
  // couldn't match the Insights tab.
  const { data: insights, refetch: refetchInsights } = useQuery({
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

  const spent = insights?.monthly_totals.at(-1)?.total ?? 0
  const income = insights?.monthly_income_totals.at(-1)?.total ?? 0
  const net = income - spent
  const categories = insights?.category_breakdown.slice(0, 5) ?? []
  const categoryMax = Math.max(1, ...categories.map(c => c.total))
  const hasAccounts = !!netWorth && netWorth.accounts.length > 0
  const recentList = transactions.slice(0, 8)

  const recent = (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-1">
        <CardTitle>Recent transactions</CardTitle>
        <Button variant="ghost" size="sm" onPress={() => router.push("/transactions")}>
          <Text>View all</Text>
        </Button>
      </CardHeader>
      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load transactions" onRetry={refetch} />
      ) : recentList.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No transactions yet"
          subtitle="Add your first transaction to get started."
          actionLabel="Add transaction"
          onAction={() => router.push("/(modals)/add-expense")}
        />
      ) : (
        <View>
          {recentList.map((t: Transaction, i) => (
            <TransactionRow key={t.id} transaction={t} last={i === recentList.length - 1} />
          ))}
        </View>
      )}
    </Card>
  )

  const byCategory = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Spending by category</CardTitle>
      </CardHeader>
      <View className="gap-4 px-4 pb-4">
        {categories.length === 0 ? (
          <Text className="text-sm text-muted-foreground">No spending this month.</Text>
        ) : (
          categories.map((c) => (
            <View key={c.category}>
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text className="text-sm capitalize">{c.category}</Text>
                <Text className="text-sm font-medium">{formatCurrency(c.total)}</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <View className="h-full rounded-full bg-foreground" style={{ width: `${(c.total / categoryMax) * 100}%` }} />
              </View>
            </View>
          ))
        )}
      </View>
    </Card>
  )

  return (
    <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}>
      <PageHeader
        title={`Hi, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={`Your money in ${dayjs().format("MMMM YYYY")}.`}
        actions={
          !isDesktop && (
            <Button size="icon" onPress={() => router.push("/(modals)/add-expense")} accessibilityLabel="Add transaction">
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
            </Button>
          )
        }
      />

      <View className="mb-6 flex-row flex-wrap gap-3">
        <Stat label="Income" value={formatCurrency(income)} hint="This month" />
        <Stat label="Spent" value={formatCurrency(spent)} hint="This month" />
        <Stat
          label="Net"
          value={`${net >= 0 ? "+" : "−"}${formatCurrency(Math.abs(net))}`}
          hint={income > 0 ? `${Math.round((net / income) * 100)}% of income saved` : "This month"}
          tone={net < 0 ? "negative" : undefined}
        />
        <Stat
          label="Net worth"
          value={hasAccounts ? formatCurrency(netWorth.net_worth) : "—"}
          hint={hasAccounts ? `${netWorth.accounts.length} account${netWorth.accounts.length === 1 ? "" : "s"}` : "Add an account"}
          onPress={() => router.push("/(modals)/accounts")}
        />
      </View>

      {isDesktop ? (
        <View className="flex-row items-start gap-6">
          <View className="flex-1">{recent}</View>
          <View className="w-[340px]">{byCategory}</View>
        </View>
      ) : (
        <View className="gap-6">
          {recent}
          {byCategory}
        </View>
      )}
    </Page>
  )
}
