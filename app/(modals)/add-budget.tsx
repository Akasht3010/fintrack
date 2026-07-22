import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo, useEffect } from "react"
import { budgetApi } from "@/api/endpoints/budgets"
import { TransactionCategory } from "@/types/domain"

const CATEGORIES: TransactionCategory[] = [
  "food", "transport", "shopping", "entertainment",
  "health", "utilities", "rent", "subscriptions", "transfer", "other"
]

export default function AddBudgetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEditMode = !!id
  const queryClient = useQueryClient()

  const { data: budgets } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetApi.list(),
    enabled: isEditMode
  })

  const existing = useMemo(
    () => budgets?.find(b => b.id === id),
    [budgets, id]
  )

  const [category, setCategory] = useState<TransactionCategory>("food")
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly")
  const [limitAmount, setLimitAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (existing) {
      setCategory(existing.category)
      setPeriod(existing.period)
      setLimitAmount(String(existing.limit_amount))
    }
  }, [existing])

  const handleSubmit = async () => {
    const amount = parseFloat(limitAmount)
    if (!limitAmount.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid limit amount")
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditMode && id) {
        await budgetApi.updateLimit(id, amount)
      } else {
        await budgetApi.create({ category, limit_amount: amount, period })
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      router.back()
    } catch (error: any) {
      if (error.response?.status === 409) {
        Alert.alert("Budget already exists", error.response?.data?.detail || "This category already has a budget for the current period.")
      } else {
        Alert.alert("Error", `Failed to ${isEditMode ? "update" : "create"} budget`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditMode && !existing) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950 items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-neutral-950">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-neutral-800">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
          {isEditMode ? "Edit Budget" : "New Budget"}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-primary-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Category */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Category</Text>
          {isEditMode ? (
            <View className="px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300 capitalize">{category}</Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-full ${
                    category === cat ? "bg-primary-600" : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium capitalize ${
                      category === cat ? "text-white" : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Period */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Period</Text>
          {isEditMode ? (
            <View className="px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300 capitalize">{period}</Text>
            </View>
          ) : (
            <View className="flex-row gap-2">
              {(["weekly", "monthly"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPeriod(p)}
                  className={`flex-1 items-center py-3 rounded-2xl ${
                    period === p ? "bg-primary-600" : "bg-neutral-100 dark:bg-neutral-800"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium capitalize ${
                      period === p ? "text-white" : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Limit amount */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Limit</Text>
          <View className="flex-row items-center border border-border dark:border-neutral-700 rounded-2xl px-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white">₹</Text>
            <TextInput
              placeholder="0.00"
              value={limitAmount}
              onChangeText={setLimitAmount}
              keyboardType="decimal-pad"
              className="flex-1 py-4 px-3 text-xl font-bold text-neutral-900 dark:text-white"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            isSubmitting ? "bg-neutral-200 dark:bg-neutral-800" : "bg-primary-600"
          }`}
        >
          <Text className={`text-base font-semibold ${isSubmitting ? "text-neutral-400" : "text-white"}`}>
            {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Create Budget"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSubmitting}
          className="w-full items-center justify-center border border-border dark:border-neutral-700 rounded-2xl py-4"
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
