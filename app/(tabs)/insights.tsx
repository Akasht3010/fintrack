import { View, Text, ScrollView, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { insightsApi } from "@/api/endpoints/insights"
import { recurringApi } from "@/api/endpoints/recurring"
import { formatCurrency, formatCompactCurrency } from "@/utils/currency"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { useTabBarClearance } from "@/hooks/useTabBarClearance"

export default function InsightsScreen() {
  const tabBarClearance = useTabBarClearance()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: () => insightsApi.summary(6)
  })

  const { data: recurring, refetch: refetchRecurring } = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringApi.summary()
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
      refetchRecurring()
    }, [refetch, refetchRecurring])
  )

  const hasAnySpend =
    !!data &&
    (data.monthly_totals.some(m => m.total > 0) ||
      data.monthly_income_totals.some(m => m.total > 0) ||
      data.category_breakdown.length > 0 ||
      data.top_merchants.length > 0)

  const maxMonthly = data
    ? Math.max(1, ...data.monthly_totals.map(m => m.total), ...data.monthly_income_totals.map(m => m.total))
    : 1
  const categoryTotal = data ? data.category_breakdown.reduce((sum, c) => sum + c.total, 0) : 0

  const currentMonthExpense = data?.monthly_totals[data.monthly_totals.length - 1]?.total ?? 0
  const currentMonthIncome = data?.monthly_income_totals[data.monthly_income_totals.length - 1]?.total ?? 0
  const savings = currentMonthIncome - currentMonthExpense
  const savingsRate = currentMonthIncome > 0 ? Math.round((savings / currentMonthIncome) * 100) : 0

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background dark:bg-transparent">
      <GlowBackground />
      <View className="px-6 pt-4 pb-6">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Insights</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load insights" onRetry={refetch} />
      ) : !data || !hasAnySpend ? (
        <EmptyState
          icon="📊"
          title="No spending yet"
          subtitle="Add or import some transactions to see your trends here."
        />
      ) : (
        <ScrollView
          className="px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
        >
          {/* This month: income vs expense */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              This month
            </Text>
            <GlassCard className="p-4">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-xs text-muted dark:text-neutral-400">Income</Text>
                  <Text className="text-xl font-bold text-green-600 dark:text-emerald-400 mt-1">
                    {formatCompactCurrency(currentMonthIncome)}
                  </Text>
                </View>
                <View className="w-px h-10 bg-border dark:bg-white/10" />
                <View className="flex-1 items-end">
                  <Text className="text-xs text-muted dark:text-neutral-400">Expenses</Text>
                  <Text className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {formatCompactCurrency(currentMonthExpense)}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-border dark:border-white/10">
                <Text className="text-xs text-muted dark:text-neutral-400">
                  {currentMonthIncome > 0 ? `Saved ${savingsRate}% of income` : "Net this month"}
                </Text>
                <Text className={`text-sm font-bold ${savings >= 0 ? "text-neutral-900 dark:text-white" : "text-red-600 dark:text-red-400"}`}>
                  {savings >= 0 ? "+" : "−"}{formatCompactCurrency(Math.abs(savings))}
                </Text>
              </View>
            </GlassCard>
          </View>

          {/* Recurring subscriptions */}
          {recurring && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Subscriptions
              </Text>
              <GlassCard
                onPress={() => router.push("/(modals)/recurring")}
                className="p-4 flex-row items-center justify-between"
              >
                {recurring.items.length > 0 ? (
                  <View>
                    <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
                      {formatCurrency(recurring.monthly_total)}
                      <Text className="text-sm font-medium text-muted dark:text-neutral-400">/mo</Text>
                    </Text>
                    <Text className="text-xs text-muted dark:text-neutral-400 mt-1">
                      {recurring.items.length} recurring bill{recurring.items.length === 1 ? "" : "s"} detected
                    </Text>
                  </View>
                ) : (
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Nothing detected yet
                    </Text>
                    <Text className="text-xs text-muted dark:text-neutral-400 mt-1">
                      We'll spot subscriptions once a merchant charges you a few times on a regular cadence
                    </Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
              </GlassCard>
            </View>
          )}

          {/* Monthly trend */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
                Last {data.monthly_totals.length} months
              </Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-green-500 dark:bg-emerald-400" />
                  <Text className="text-[11px] text-muted dark:text-neutral-400">Income</Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-primary-600 dark:bg-accent-500" />
                  <Text className="text-[11px] text-muted dark:text-neutral-400">Expenses</Text>
                </View>
              </View>
            </View>
            <GlassCard className="p-4">
              <View className="flex-row items-end justify-between h-32">
                {data.monthly_totals.map((m, i) => {
                  const income = data.monthly_income_totals[i]?.total ?? 0
                  const expenseHeightPct = Math.max(4, (m.total / maxMonthly) * 100)
                  const incomeHeightPct = Math.max(4, (income / maxMonthly) * 100)
                  return (
                    <View key={`${m.year}-${m.month}`} className="flex-1 items-center gap-2">
                      <View className="flex-1 flex-row justify-center items-end gap-1 w-full">
                        <View
                          style={{ height: `${incomeHeightPct}%` }}
                          className="w-2.5 rounded-full bg-green-500 dark:bg-emerald-400"
                        />
                        <View
                          style={{ height: `${expenseHeightPct}%` }}
                          className="w-2.5 rounded-full bg-primary-600 dark:bg-accent-500"
                        />
                      </View>
                      <Text className="text-[10px] font-medium text-muted dark:text-neutral-400">
                        {m.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </GlassCard>
          </View>

          {/* Category breakdown */}
          {data.category_breakdown.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                This month by category
              </Text>
              <GlassCard className="p-4">
                <View className="gap-4">
                  {data.category_breakdown.map((c) => {
                    const pct = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0
                    return (
                      <View key={c.category}>
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-base">{CATEGORY_ICONS[c.category] || "📌"}</Text>
                            <Text className="text-sm font-medium text-neutral-900 dark:text-white capitalize">
                              {c.category}
                            </Text>
                          </View>
                          <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {formatCurrency(c.total)}
                          </Text>
                        </View>
                        <View className="h-2 rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden">
                          <View
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-primary-600 dark:bg-accent-500"
                          />
                        </View>
                      </View>
                    )
                  })}
                </View>
              </GlassCard>
            </View>
          )}

          {/* Top merchants */}
          {data.top_merchants.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Top merchants
              </Text>
              <GlassCard>
                {data.top_merchants.map((merchant, index) => (
                  <View
                    key={merchant.merchant}
                    className={`flex-row items-center justify-between px-4 py-4 ${
                      index < data.top_merchants.length - 1 ? "border-b border-border dark:border-white/10" : ""
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {merchant.merchant}
                      </Text>
                      <Text className="text-xs text-muted dark:text-neutral-400 mt-1">
                        {merchant.count} transaction{merchant.count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-primary-600 dark:text-accent-400">
                      {formatCompactCurrency(merchant.total)}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
