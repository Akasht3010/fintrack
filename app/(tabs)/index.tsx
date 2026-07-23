import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { useColorScheme } from "nativewind"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { useTransactionStore } from "@/store/useTransactionStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency, formatCompactCurrency } from "@/utils/currency"
import { formatDateShort, isThisMonth } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { useTabBarClearance } from "@/hooks/useTabBarClearance"
import { useCallback, useState } from "react"

function SummaryCardContent({ totalSpent, totalIncome, net }: { totalSpent: number; totalIncome: number; net: number }) {
  return (
    <>
      <Text className="text-white text-sm font-medium opacity-80">This month</Text>
      <View className="flex-row items-center mt-3">
        <View className="flex-1">
          <Text className="text-white text-xs opacity-70">Expenses</Text>
          <Text className="text-white text-2xl font-bold mt-1">{formatCompactCurrency(totalSpent)}</Text>
        </View>
        <View className="w-px h-10 bg-white/25" />
        <View className="flex-1 items-end">
          <Text className="text-white text-xs opacity-70">Income</Text>
          <Text className="text-white text-2xl font-bold mt-1">{formatCompactCurrency(totalIncome)}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-white/20">
        <Text className="text-white text-xs opacity-70">Net</Text>
        <Text className="text-white text-sm font-bold">
          {net >= 0 ? "+" : "−"}{formatCompactCurrency(Math.abs(net))}
        </Text>
      </View>
    </>
  )
}

export default function DashboardScreen() {
  const navigation = useNavigation()
  const { user } = useUserStore()
  const { transactions, setTransactions } = useTransactionStore()
  const [refreshing, setRefreshing] = useState(false)
  const tabBarClearance = useTabBarClearance()
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"

  const { isLoading, error, refetch } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await transactionApi.list({ page: 1, limit: 50 })
      setTransactions(response.transactions)
      return response.transactions
    },
    enabled: !!user?.id
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }, [refetch])

  // "This month" should mean this month — scope the summary to it rather
  // than whatever happens to be in the last 50 fetched transactions.
  const thisMonthTransactions = transactions.filter(t => isThisMonth(t.date))

  const totalSpent = thisMonthTransactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0)

  const totalIncome = thisMonthTransactions
    .filter(t => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0)

  const net = totalIncome - totalSpent

  const categoryTotals = thisMonthTransactions
    .filter(t => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background dark:bg-transparent">
      <GlowBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarClearance }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm text-muted dark:text-neutral-400">Welcome back,</Text>
            <Text className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">
              {user?.name ?? "User"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("(modals)/add-expense" as never)}
            className="bg-primary-600 dark:bg-accent-600 rounded-full w-12 h-12 items-center justify-center"
          >
            <Text className="text-white text-xl font-bold">+</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View className="px-6 mb-6">
          {isDark ? (
            <LinearGradient
              colors={["#6366f1", "#7c3aed"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24 }}
            >
              <SummaryCardContent totalSpent={totalSpent} totalIncome={totalIncome} net={net} />
            </LinearGradient>
          ) : (
            <View className="bg-primary-600 rounded-3xl p-6">
              <SummaryCardContent totalSpent={totalSpent} totalIncome={totalIncome} net={net} />
            </View>
          )}
        </View>

        {/* Top Category */}
        {topCategory && (
          <View className="px-6 mb-6">
            <GlassCard className="p-4">
              <Text className="text-xs text-muted dark:text-neutral-400 uppercase tracking-wider mb-2">
                Top Category
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-neutral-900 dark:text-white capitalize">
                  {topCategory[0]}
                </Text>
                <Text className="text-lg font-bold text-primary-600 dark:text-accent-400">
                  {formatCurrency(topCategory[1])}
                </Text>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Recent Transactions */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Recent
          </Text>

          {isLoading && (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
          )}

          {!isLoading && error && (
            <ErrorState message="Failed to load transactions" onRetry={refetch} />
          )}

          {!isLoading && !error && transactions.length === 0 && (
            <EmptyState
              icon="💸"
              title="No transactions yet"
              subtitle="Add your first expense to get started."
            />
          )}

          {!isLoading && !error && transactions.length > 0 && (
            <View className="gap-3">
              {transactions.slice(0, 10).map((transaction) => (
                <GlassCard
                  key={transaction.id}
                  onPress={() => router.push({ pathname: "/(modals)/transaction-detail", params: { id: transaction.id } })}
                  className="p-4 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/10 items-center justify-center">
                      <Text className="text-lg">
                        {CATEGORY_ICONS[transaction.category] || "📌"}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {transaction.merchant}
                      </Text>
                      <Text className="text-xs text-muted dark:text-neutral-400 mt-1">
                        {formatDateShort(transaction.date)}
                      </Text>
                    </View>
                  </View>
                  <Text className={`text-sm font-bold ${
                    transaction.type === "debit"
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-emerald-400"
                  }`}>
                    {transaction.type === "debit" ? "−" : "+"}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </GlassCard>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
