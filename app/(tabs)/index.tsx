import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { useTransactionStore } from "@/store/useTransactionStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency, formatCompactCurrency } from "@/utils/currency"
import { formatDateShort } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { useCallback } from "react"

export default function DashboardScreen() {
  const navigation = useNavigation()
  const { user } = useUserStore()
  const { transactions, setTransactions } = useTransactionStore()

  const { isLoading, error, refetch } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await transactionApi.list(1, 50)
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

  const totalSpent = transactions
    .filter(t => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0)

  const categoryTotals = transactions
    .filter(t => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm text-muted">Welcome back,</Text>
            <Text className="text-3xl font-bold text-neutral-900 mt-1">
              {user?.name ?? "User"}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate("(modals)/add-expense" as never)}
            className="bg-primary-600 rounded-full w-12 h-12 items-center justify-center"
          >
            <Text className="text-white text-xl font-bold">+</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Card */}
        <View className="px-6 mb-6">
          <View className="bg-primary-600 rounded-3xl p-6">
            <Text className="text-white text-sm font-medium opacity-80">
              This month
            </Text>
            <Text className="text-4xl font-bold text-white mt-2">
              {formatCompactCurrency(totalSpent)}
            </Text>
            <Text className="text-white text-xs mt-3 opacity-70">
              {transactions.filter(t => t.type === "debit").length} transactions
            </Text>
          </View>
        </View>

        {/* Top Category */}
        {topCategory && (
          <View className="px-6 mb-6">
            <View className="bg-white border border-border rounded-2xl p-4">
              <Text className="text-xs text-muted uppercase tracking-wider mb-2">
                Top Category
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-semibold text-neutral-900 capitalize">
                  {topCategory[0]}
                </Text>
                <Text className="text-lg font-bold text-primary-600">
                  {formatCurrency(topCategory[1])}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Transactions */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-neutral-900 mb-4">
            Recent
          </Text>

          {isLoading && (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
          )}

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <Text className="text-red-700 text-sm">
                Failed to load transactions
              </Text>
            </View>
          )}

          {!isLoading && transactions.length === 0 && (
            <View className="bg-neutral-50 rounded-2xl p-6 items-center justify-center py-12">
              <Text className="text-neutral-500 text-center text-sm">
                No transactions yet.{"\n"}Add your first expense to get started.
              </Text>
            </View>
          )}

          {!isLoading && transactions.length > 0 && (
            <View className="gap-3">
              {transactions.slice(0, 10).map((transaction) => (
                <View
                  key={transaction.id}
                  className="bg-white border border-border rounded-2xl p-4 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-neutral-900">
                      {transaction.merchant}
                    </Text>
                    <Text className="text-xs text-muted mt-1">
                      {formatDateShort(transaction.date)}
                    </Text>
                  </View>
                  <Text className={`text-sm font-bold ${
                    transaction.type === "debit"
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    {transaction.type === "debit" ? "-" : "+"}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
