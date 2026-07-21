import { View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency } from "@/utils/currency"
import { formatDateShort, formatDate } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Transaction } from "@/types/domain"
import { useState, useCallback } from "react"

const CATEGORIES = [
  "all",
  "food",
  "transport",
  "shopping",
  "entertainment",
  "health",
  "utilities",
  "rent",
  "subscriptions",
  "transfer",
  "other"
]

export default function TransactionsScreen() {
  const { user } = useUserStore()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [page, setPage] = useState(1)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const { isLoading, error, refetch } = useQuery({
    queryKey: ["transactions", user?.id, selectedCategory, page],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await transactionApi.list(page, 50)
      
      if (page === 1) {
        setAllTransactions(response.transactions)
      } else {
        setAllTransactions(prev => [...prev, ...response.transactions])
      }
      
      return response.transactions
    },
    enabled: !!user?.id
  })

  useFocusEffect(
    useCallback(() => {
      setPage(1)
      refetch()
    }, [refetch])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setPage(1)
    setAllTransactions([])
    refetch().finally(() => setRefreshing(false))
  }, [refetch])

  const filteredTransactions = allTransactions.filter(t => {
    if (selectedCategory === "all") return true
    return t.category === selectedCategory
  })

  // Group by date
  const groupedByDate = filteredTransactions.reduce((acc, t) => {
    const date = formatDate(t.date)
    if (!acc[date]) acc[date] = []
    acc[date].push(t)
    return acc
  }, {} as Record<string, typeof filteredTransactions>)

  const categoryStats = filteredTransactions
    .filter(t => t.type === "debit")
    .reduce((acc, t) => ({
      count: acc.count + 1,
      total: acc.total + t.amount
    }), { count: 0, total: 0 })

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-3xl font-bold text-neutral-900">Transactions</Text>
        {selectedCategory !== "all" && (
          <Text className="text-sm text-muted mt-2 capitalize">
            {categoryStats.count} transactions • {formatCurrency(categoryStats.total)}
          </Text>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-6 mb-2"
        style={{ flexGrow: 0, height: 40 }}
        contentContainerStyle={{ gap: 8, alignItems: "center" }}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => {
              setSelectedCategory(category)
              setPage(1)
            }}
            className={`px-4 py-2 rounded-full ${
              selectedCategory === category
                ? "bg-primary-600"
                : "bg-white border border-border"
            }`}
          >
            <Text
              className={`text-sm font-medium capitalize ${
                selectedCategory === category
                  ? "text-white"
                  : "text-neutral-700"
              }`}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transactions List */}
      <View className="flex-1">
        {isLoading && page === 1 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.primary[600]} />
          </View>
        ) : error ? (
          <ErrorState message="Failed to load transactions" onRetry={refetch} />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No transactions"
            subtitle={selectedCategory === "all" ? "Add your first expense to get started." : "No transactions in this category yet."}
          />
        ) : (
          <ScrollView 
            className="px-6"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(groupedByDate).map(([date, txns]) => (
              <View key={date} className="mb-6">
                {/* Date Header */}
                <Text className="text-sm font-semibold text-neutral-700 mb-3 uppercase tracking-wider">
                  {date}
                </Text>

                {/* Transactions for this date */}
                <View className="gap-2">
                  {txns.map((transaction) => (
                    <TouchableOpacity
                      key={transaction.id}
                      onPress={() => router.push({ pathname: "/(modals)/transaction-detail", params: { id: transaction.id } })}
                      className="bg-white border border-border rounded-2xl p-4 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center">
                          <Text className="text-lg">
                            {CATEGORY_ICONS[transaction.category] || "📌"}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-neutral-900">
                            {transaction.merchant}
                          </Text>
                          <Text className="text-xs text-muted capitalize">
                            {transaction.category}
                          </Text>
                        </View>
                      </View>

                      <Text
                        className={`text-sm font-bold ${
                          transaction.type === "debit"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {transaction.type === "debit" ? "−" : "+"}
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {/* Load more spacing */}
            <View className="h-8" />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  )
}
