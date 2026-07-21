import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useColorScheme } from "nativewind"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { budgetApi } from "@/api/endpoints/budgets"
import { formatCurrency } from "@/utils/currency"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"

export default function BudgetScreen() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const { colorScheme } = useColorScheme()
  const trashColor = colorScheme === "dark" ? "#9ca3af" : Colors.muted

  const { data: budgets, isLoading, error, refetch } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetApi.list()
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

  const handleDelete = (id: string, category: string) => {
    Alert.alert(
      "Delete budget",
      `Remove the ${category} budget?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await budgetApi.delete(id)
            queryClient.invalidateQueries({ queryKey: ["budgets"] })
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-neutral-950">
      <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
        <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Budget</Text>
        <TouchableOpacity
          onPress={() => router.push("/(modals)/add-budget")}
          className="bg-primary-600 rounded-full w-12 h-12 items-center justify-center"
        >
          <Text className="text-white text-xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load budgets" onRetry={refetch} />
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No budgets yet"
          subtitle="Set a limit for a category to start tracking."
        />
      ) : (
        <ScrollView
          className="px-6"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View className="gap-3">
            {budgets.map((budget) => {
              const percent = Math.min(budget.spent_amount / budget.limit_amount, 1) * 100
              const isOver = budget.spent_amount > budget.limit_amount
              const remaining = budget.limit_amount - budget.spent_amount

              return (
                <TouchableOpacity
                  key={budget.id}
                  onPress={() => router.push({ pathname: "/(modals)/add-budget", params: { id: budget.id } })}
                  className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl p-4"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 items-center justify-center">
                        <Text className="text-lg">
                          {CATEGORY_ICONS[budget.category] || "📌"}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-white capitalize">
                          {budget.category}
                        </Text>
                        <Text className="text-xs text-muted dark:text-neutral-400 capitalize">
                          {budget.period}
                        </Text>
                      </View>
                    </View>
                    <Text className={`text-xs font-medium mr-2 ${isOver ? "text-red-600 dark:text-red-400" : "text-muted dark:text-neutral-400"}`}>
                      {isOver
                        ? `${formatCurrency(Math.abs(remaining))} over`
                        : `${formatCurrency(remaining)} left`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(budget.id, budget.category)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={trashColor} />
                    </TouchableOpacity>
                  </View>

                  <View className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden mb-2">
                    <View
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-primary-600"}`}
                    />
                  </View>

                  <Text className="text-xs text-muted dark:text-neutral-400">
                    {formatCurrency(budget.spent_amount)} of {formatCurrency(budget.limit_amount)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Clearance for the floating tab bar */}
          <View style={{ height: 140 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
