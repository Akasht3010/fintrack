import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { useUserStore } from "@/store/useUserStore"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency } from "@/utils/currency"
import { parseMoneyInput, sumMoney } from "@/utils/money"
import { formatDate } from "@/utils/date"
import { useTheme } from "@/lib/theme"
import { useTabBarClearance } from "@/hooks/useTabBarClearance"
import { useCategories } from "@/hooks/useCategories"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { DateRange, DATE_RANGES, dateFromForRange } from "@/utils/dateRanges"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { PageHeader } from "@/components/layout"
import { TransactionRow } from "@/components/layout/TransactionRow"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field } from "@/components/ui/misc"
import type { Transaction } from "@/types/domain"

const PAGE_SIZE = 50

export default function TransactionsScreen() {
  const { user } = useUserStore()
  const { colors } = useTheme()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const tabBarClearance = useTabBarClearance()
  const { data: categories } = useCategories()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const hasExtraFilters = dateRange !== "all" || !!minAmount || !!maxAmount
  const hasActiveFilters = selectedCategory !== "all" || !!debouncedSearch || hasExtraFilters

  const { data, isLoading, isFetchingNextPage, error, refetch, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["transactions", user?.id, selectedCategory, debouncedSearch, dateRange, minAmount, maxAmount],
    queryFn: ({ pageParam, signal }) =>
      transactionApi.list({
        page: pageParam,
        limit: PAGE_SIZE,
        category: selectedCategory === "all" ? undefined : selectedCategory,
        q: debouncedSearch || undefined,
        date_from: dateFromForRange(dateRange),
        min_amount: parseMoneyInput(minAmount) ?? undefined,
        max_amount: parseMoneyInput(maxAmount) ?? undefined
      }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: !!user?.id
  })

  const allTransactions = data?.pages.flatMap(p => p.transactions) ?? []

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }, [refetch])

  const groupedByDate = allTransactions.reduce((acc, t) => {
    const date = formatDate(t.date)
    if (!acc[date]) acc[date] = []
    acc[date].push(t)
    return acc
  }, {} as Record<string, Transaction[]>)

  const debits = allTransactions.filter(t => t.type === "debit")
  const spentTotal = sumMoney(debits.map(t => t.amount))

  const categoryOptions = [{ value: "all", label: "All" }, ...(categories?.map(c => ({ value: c.name, label: c.name.charAt(0).toUpperCase() + c.name.slice(1) })) ?? [])]

  return (
    <SafeAreaView edges={isDesktop ? [] : ["top"]} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: tabBarClearance }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}
      >
        <View className="w-full flex-1 px-4 md:mx-auto md:max-w-[1080px] md:px-8">
          <PageHeader
            title="Transactions"
            description={
              hasActiveFilters && allTransactions.length > 0
                ? `${allTransactions.length} shown · ${formatCurrency(spentTotal)} spent`
                : "Everything you've spent and received."
            }
          />

          <View className="mb-3 flex-row items-center gap-2">
            <Input
              containerClassName="flex-1"
              placeholder="Search merchant or description"
              value={searchInput}
              onChangeText={setSearchInput}
              leading={<Ionicons name="search" size={16} color={colors.mutedForeground} />}
              trailing={
                searchInput.length > 0 && (
                  <Pressable onPress={() => setSearchInput("")} hitSlop={8} accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                  </Pressable>
                )
              }
            />
            <Button
              variant={showFilters || hasExtraFilters ? "default" : "outline"}
              onPress={() => setShowFilters(v => !v)}
              accessibilityLabel="Filters"
            >
              <Ionicons name="options-outline" size={16} color={showFilters || hasExtraFilters ? colors.primaryForeground : colors.foreground} />
              {isDesktop && <Text>Filters</Text>}
            </Button>
          </View>

          {showFilters && (
            <Card className="mb-3 gap-4 p-4">
              <Field label="Date range">
                <ChipGroup options={DATE_RANGES.map(r => ({ value: r.key, label: r.label }))} value={dateRange} onChange={setDateRange} />
              </Field>
              <Field label="Amount">
                <View className="flex-row items-center gap-2">
                  <Input containerClassName="flex-1" placeholder="Min" value={minAmount} onChangeText={setMinAmount} keyboardType="decimal-pad" />
                  <Text className="text-muted-foreground">–</Text>
                  <Input containerClassName="flex-1" placeholder="Max" value={maxAmount} onChangeText={setMaxAmount} keyboardType="decimal-pad" />
                </View>
              </Field>
              {hasExtraFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onPress={() => {
                    setDateRange("all")
                    setMinAmount("")
                    setMaxAmount("")
                  }}
                >
                  <Text>Clear filters</Text>
                </Button>
              )}
            </Card>
          )}

          <View className="mb-5">
            <ChipGroup options={categoryOptions} value={selectedCategory} onChange={setSelectedCategory} scroll={!isDesktop} />
          </View>

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-16">
              <ActivityIndicator color={colors.mutedForeground} />
            </View>
          ) : error ? (
            <ErrorState message="Failed to load transactions" onRetry={refetch} />
          ) : allTransactions.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="No transactions"
              subtitle={hasActiveFilters ? "Nothing matches these filters." : "Add your first transaction to get started."}
              actionLabel={hasActiveFilters ? undefined : "Add transaction"}
              onAction={hasActiveFilters ? undefined : () => router.push("/(modals)/add-expense")}
            />
          ) : (
            <View className="gap-5">
              {Object.entries(groupedByDate).map(([date, txns]) => (
                <View key={date}>
                  <Text className="mb-2 text-[13px] font-medium text-muted-foreground">{date}</Text>
                  <Card className="overflow-hidden">
                    {txns.map((t, i) => (
                      <TransactionRow key={t.id} transaction={t} last={i === txns.length - 1} wide={isDesktop} showDate={false} />
                    ))}
                  </Card>
                </View>
              ))}

              {hasNextPage && (
                <Button variant="outline" onPress={() => fetchNextPage()} loading={isFetchingNextPage} className="self-center">
                  <Text>Load more</Text>
                </Button>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
