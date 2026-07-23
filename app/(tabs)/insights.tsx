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
      data.category_breakdown.length > 0 ||
      data.top_merchants.length > 0)

  const maxMonthly = data ? Math.max(1, ...data.monthly_totals.map(m => m.total)) : 1
  const categoryTotal = data ? data.category_breakdown.reduce((sum, c) => sum + c.total, 0) : 0

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
            <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Last {data.monthly_totals.length} months
            </Text>
            <GlassCard className="p-4">
              <View className="flex-row items-end justify-between h-32">
                {data.monthly_totals.map((m) => {
                  const heightPct = Math.max(4, (m.total / maxMonthly) * 100)
                  return (
                    <View key={`${m.year}-${m.month}`} className="flex-1 items-center gap-2">
                      <View className="flex-1 justify-end w-full items-center">
                        <View
                          style={{ height: `${heightPct}%` }}
                          className="w-3 rounded-full bg-primary-600 dark:bg-accent-500"
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
