import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect } from "@react-navigation/native"
import { router } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { budgetApi } from "@/api/endpoints/budgets"
import { formatCurrency } from "@/utils/currency"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"

export default function BudgetScreen() {
  const queryClient = useQueryClient()

  const { data: budgets, isLoading, error, refetch } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetApi.list()
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

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
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
        <Text className="text-3xl font-bold text-neutral-900">Budget</Text>
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
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-600 text-center">Failed to load budgets</Text>
        </View>
      ) : !budgets || budgets.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-neutral-500 text-center text-sm">
            No budgets yet.{"\n"}Set a limit for a category to start tracking.
          </Text>
        </View>
      ) : (
        <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
          <View className="gap-3">
            {budgets.map((budget) => {
              const percent = Math.min(budget.spent_amount / budget.limit_amount, 1) * 100
              const isOver = budget.spent_amount > budget.limit_amount
              const remaining = budget.limit_amount - budget.spent_amount

              return (
                <TouchableOpacity
                  key={budget.id}
                  onPress={() => router.push({ pathname: "/(modals)/add-budget", params: { id: budget.id } })}
                  onLongPress={() => handleDelete(budget.id, budget.category)}
                  className="bg-white border border-border rounded-2xl p-4"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-neutral-100 items-center justify-center">
                        <Text className="text-lg">
                          {CATEGORY_ICONS[budget.category] || "📌"}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-neutral-900 capitalize">
                          {budget.category}
                        </Text>
                        <Text className="text-xs text-muted capitalize">
                          {budget.period}
                        </Text>
                      </View>
                    </View>
                    <Text className={`text-xs font-medium ${isOver ? "text-red-600" : "text-muted"}`}>
                      {isOver
                        ? `${formatCurrency(Math.abs(remaining))} over`
                        : `${formatCurrency(remaining)} left`}
                    </Text>
                  </View>

                  <View className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-2">
                    <View
                      style={{ width: `${percent}%` }}
                      className={`h-full rounded-full ${isOver ? "bg-red-500" : "bg-primary-600"}`}
                    />
                  </View>

                  <Text className="text-xs text-muted">
                    {formatCurrency(budget.spent_amount)} of {formatCurrency(budget.limit_amount)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
