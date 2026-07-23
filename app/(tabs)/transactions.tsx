import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import { useUserStore } from "@/store/useUserStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { Transaction } from "@/types/domain"
import { useTabBarClearance } from "@/hooks/useTabBarClearance"
import { useState, useCallback, useEffect } from "react"

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

type DateRange = "all" | "7d" | "30d" | "month"

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" }
]

function dateFromForRange(range: DateRange): string | undefined {
  switch (range) {
    case "7d": return dayjs().subtract(7, "day").startOf("day").toISOString()
    case "30d": return dayjs().subtract(30, "day").startOf("day").toISOString()
    case "month": return dayjs().startOf("month").toISOString()
    default: return undefined
  }
}

const PAGE_SIZE = 50

export default function TransactionsScreen() {
  const { user } = useUserStore()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const tabBarClearance = useTabBarClearance()

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [selectedCategory, debouncedSearch, dateRange, minAmount, maxAmount])

  const hasActiveFilters =
    selectedCategory !== "all" || !!debouncedSearch || dateRange !== "all" || !!minAmount || !!maxAmount

  const { isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["transactions", user?.id, selectedCategory, debouncedSearch, dateRange, minAmount, maxAmount, page],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await transactionApi.list({
        page,
        limit: PAGE_SIZE,
        category: selectedCategory === "all" ? undefined : selectedCategory,
        q: debouncedSearch || undefined,
        date_from: dateFromForRange(dateRange),
        min_amount: minAmount ? parseFloat(minAmount) : undefined,
        max_amount: maxAmount ? parseFloat(maxAmount) : undefined
      })

      setTotal(response.total)
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
      if (page === 1) {
        refetch()
      } else {
        setPage(1)
      }
    }, [refetch]) // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    if (page === 1) {
      refetch().finally(() => setRefreshing(false))
    } else {
      setPage(1)
      setRefreshing(false)
    }
  }, [refetch, page])

  const onLoadMore = () => setPage(p => p + 1)

  // Group by date
  const groupedByDate = allTransactions.reduce((acc, t) => {
    const date = formatDate(t.date)
    if (!acc[date]) acc[date] = []
    acc[date].push(t)
    return acc
  }, {} as Record<string, typeof allTransactions>)

  const stats = allTransactions
    .filter(t => t.type === "debit")
    .reduce((acc, t) => ({
      count: acc.count + 1,
      total: acc.total + t.amount
    }), { count: 0, total: 0 })

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background dark:bg-transparent">
      <GlowBackground />
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Transactions</Text>
        {hasActiveFilters && (
          <Text className="text-sm text-muted dark:text-neutral-400 mt-2">
            {stats.count} transactions • {formatCurrency(stats.total)}
          </Text>
        )}
      </View>

      {/* Search + filter toggle */}
      <View className="px-6 mb-3 flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-3">
          <Ionicons name="search" size={16} color={Colors.muted} />
          <TextInput
            placeholder="Search merchant or description"
            value={searchInput}
            onChangeText={setSearchInput}
            className="flex-1 py-3 px-2 text-sm text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(v => !v)}
          className={`w-11 h-11 items-center justify-center rounded-2xl border ${
            showFilters || dateRange !== "all" || minAmount || maxAmount
              ? "bg-primary-600 dark:bg-accent-600 border-transparent"
              : "border-border dark:border-white/15 dark:bg-white/5"
          }`}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={showFilters || dateRange !== "all" || minAmount || maxAmount ? "#fff" : Colors.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Expandable filter panel */}
      {showFilters && (
        <View className="px-6 mb-3">
          <GlassCard className="p-4">
            <Text className="text-xs font-medium text-muted dark:text-neutral-400 uppercase tracking-wider mb-2">
              Date range
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {DATE_RANGES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setDateRange(r.key)}
                  className={`px-3 py-2 rounded-full ${
                    dateRange === r.key ? "bg-primary-600 dark:bg-accent-600" : "bg-neutral-100 dark:bg-white/10"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      dateRange === r.key ? "text-white" : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-medium text-muted dark:text-neutral-400 uppercase tracking-wider mb-2">
              Amount
            </Text>
            <View className="flex-row items-center gap-3">
              <TextInput
                placeholder="Min"
                value={minAmount}
                onChangeText={setMinAmount}
                keyboardType="decimal-pad"
                className="flex-1 border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
                placeholderTextColor="#9ca3af"
              />
              <Text className="text-muted dark:text-neutral-400">–</Text>
              <TextInput
                placeholder="Max"
                value={maxAmount}
                onChangeText={setMaxAmount}
                keyboardType="decimal-pad"
                className="flex-1 border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </GlassCard>
        </View>
      )}

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
            onPress={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full ${
              selectedCategory === category
                ? "bg-primary-600 dark:bg-accent-600"
                : "bg-white dark:bg-white/10 border border-border dark:border-white/15"
            }`}
          >
            <Text
              className={`text-sm font-medium capitalize ${
                selectedCategory === category
                  ? "text-white"
                  : "text-neutral-700 dark:text-neutral-300"
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
        ) : allTransactions.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No transactions"
            subtitle={hasActiveFilters ? "No transactions match these filters." : "Add your first expense to get started."}
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
                <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 uppercase tracking-wider">
                  {date}
                </Text>

                {/* Transactions for this date */}
                <View className="gap-2">
                  {txns.map((transaction) => (
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
                          <Text className="text-xs text-muted dark:text-neutral-400 capitalize">
                            {transaction.category}
                          </Text>
                        </View>
                      </View>

                      <Text
                        className={`text-sm font-bold ${
                          transaction.type === "debit"
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-emerald-400"
                        }`}
                      >
                        {transaction.type === "debit" ? "−" : "+"}
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </GlassCard>
                  ))}
                </View>
              </View>
            ))}

            {allTransactions.length < total && (
              <TouchableOpacity
                onPress={onLoadMore}
                disabled={isFetching}
                className="items-center justify-center py-4 mb-2"
              >
                {isFetching ? (
                  <ActivityIndicator color={Colors.primary[600]} />
                ) : (
                  <Text className="text-sm font-semibold text-primary-600 dark:text-accent-400">Load more</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Clearance for the floating tab bar */}
            <View style={{ height: tabBarClearance }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  )
}
