import { View, Pressable, ActivityIndicator, RefreshControl } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { Decimal } from "decimal.js"
import { budgetApi } from "@/api/endpoints/budgets"
import { formatCurrency } from "@/utils/currency"
import { toDecimal } from "@/utils/money"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Page, PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { confirm } from "@/utils/confirm"

export default function BudgetScreen() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const { colors } = useTheme()
  const isDesktop = useIsDesktop()

  const { data: budgets, isLoading, error, refetch } = useQuery({
    queryKey: ["budgets"],
    queryFn: ({ signal }) => budgetApi.list(signal)
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

  const handleDelete = async (id: number, category: string) => {
    const confirmed = await confirm("Delete budget", `Remove the ${category} budget?`, {
      confirmLabel: "Delete",
      destructive: true
    })
    if (!confirmed) return
    await budgetApi.delete(id)
    queryClient.invalidateQueries({ queryKey: ["budgets"] })
  }

  const newBudget = () => router.push("/(modals)/add-budget")

  return (
    <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mutedForeground} />}>
      <PageHeader
        title="Budgets"
        description="Spending limits per category."
        actions={
          isDesktop ? (
            <Button onPress={newBudget}>
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text>New budget</Text>
            </Button>
          ) : (
            <Button size="icon" onPress={newBudget} accessibilityLabel="New budget">
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
            </Button>
          )
        }
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load budgets" onRetry={refetch} />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No budgets yet"
          subtitle="Set a limit for a category to start tracking."
          actionLabel="New budget"
          onAction={newBudget}
        />
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {budgets.map((budget) => {
            // remaining_amount is server-computed (limit_amount -
            // spent_amount) — use it rather than re-deriving the
            // subtraction client-side.
            const remaining = toDecimal(budget.remaining_amount)
            const isOver = remaining.isNegative()
            const percent = Decimal.min(toDecimal(budget.spent_amount).div(toDecimal(budget.limit_amount)).times(100), 100).toNumber()

            return (
              <Pressable
                key={budget.id}
                onPress={() => router.push({ pathname: "/(modals)/add-budget", params: { id: budget.id } })}
                accessibilityRole="button"
                className="w-full rounded-lg border border-border bg-card p-4 active:bg-accent web:cursor-pointer web:hover:bg-accent/60 md:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-[15px] font-medium capitalize">{budget.category}</Text>
                    <Text className="mt-0.5 text-xs capitalize text-muted-foreground">{budget.period}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(budget.id, budget.category)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${budget.category} budget`}
                    className="h-7 w-7 items-center justify-center rounded-md web:cursor-pointer web:hover:bg-accent"
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                <View className="mt-4 flex-row items-baseline justify-between">
                  <Text className="text-lg font-semibold">{formatCurrency(budget.spent_amount)}</Text>
                  <Text className="text-xs text-muted-foreground">of {formatCurrency(budget.limit_amount)}</Text>
                </View>
                <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <View
                    style={{ width: `${percent}%` }}
                    className={cn("h-full rounded-full", isOver ? "bg-destructive" : "bg-foreground")}
                  />
                </View>
                <Text className={cn("mt-2 text-xs", isOver ? "text-destructive" : "text-muted-foreground")}>
                  {isOver ? `${formatCurrency(remaining.abs())} over budget` : `${formatCurrency(remaining)} left`}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
    </Page>
  )
}
