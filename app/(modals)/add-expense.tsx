import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { useCreateTransaction } from "@/hooks/useCreateTransaction"
import { transactionApi } from "@/api/endpoints/transactions"
import { budgetApi } from "@/api/endpoints/budgets"
import { Budget } from "@/types/domain"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { useState, useEffect } from "react"

const CATEGORIES = [
  "food", "transport", "shopping", "entertainment",
  "health", "utilities", "rent", "subscriptions", "transfer", "other"
]

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEditMode = !!id
  const { user } = useUserStore()
  const { mutate: createTransaction, isPending: isCreating } = useCreateTransaction()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionApi.getById(id!),
    enabled: isEditMode
  })

  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [description, setDescription] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("food")

  useEffect(() => {
    if (existing) {
      setAmount(String(existing.amount))
      setMerchant(existing.merchant)
      setDescription(existing.description === existing.merchant ? "" : existing.description)
      setSelectedCategory(existing.category)
    }
  }, [existing])

  const isPending = isCreating || isSaving

  const handleSubmit = async () => {
    if (!amount.trim()) {
      Alert.alert("Error", "Please enter an amount")
      return
    }

    if (!merchant.trim()) {
      Alert.alert("Error", "Please enter merchant name")
      return
    }

    if (isEditMode) {
      setIsSaving(true)
      try {
        await transactionApi.update(id!, {
          amount: parseFloat(amount),
          category: selectedCategory,
          merchant,
          description: description || merchant
        })
        queryClient.invalidateQueries({ queryKey: ["transactions"] })
        queryClient.invalidateQueries({ queryKey: ["transaction", id] })
        queryClient.invalidateQueries({ queryKey: ["budgets"] })
        router.back()
      } catch (error: any) {
        Alert.alert("Error", "Failed to update transaction")
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found")
      return
    }

    let budgetsBefore: Budget[] = []
    try {
      budgetsBefore = await budgetApi.list()
    } catch {
      // Alerting is best-effort — don't block adding the expense over this
    }

    createTransaction({
      amount: parseFloat(amount),
      currency: "INR",
      type: "debit",
      category: selectedCategory,
      merchant,
      description: description || merchant,
      date: new Date().toISOString(),
      source: "manual",
      is_recurring: false
    }, {
      onSuccess: async () => {
        try {
          const budgetsAfter = await budgetApi.list()
          await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
          queryClient.invalidateQueries({ queryKey: ["budgets"] })
        } catch {
          // Same — never let alerting get in the way of the actual save
        }
        router.back()
      },
      onError: (error: any) => {
        Alert.alert("Error", "Failed to add expense")
      }
    })
  }

  if (isEditMode && isLoadingExisting) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-transparent items-center justify-center">
        <GlowBackground />
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">
          {isEditMode ? "Edit Transaction" : "Add Expense"}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Amount */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Amount</Text>
          <View className="flex-row items-center border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4">
            <Text className="text-2xl font-bold text-neutral-900 dark:text-white">₹</Text>
            <TextInput
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              className="flex-1 py-4 px-3 text-xl font-bold text-neutral-900 dark:text-white"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Merchant */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Merchant</Text>
          <TextInput
            placeholder="e.g., Swiggy, Uber, etc."
            value={merchant}
            onChangeText={setMerchant}
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Category */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === cat
                    ? "bg-primary-600 dark:bg-accent-600"
                    : "bg-neutral-100 dark:bg-white/10"
                }`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${
                    selectedCategory === cat
                      ? "text-white"
                      : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Description (optional)</Text>
          <TextInput
            placeholder="Add notes"
            value={description}
            onChangeText={setDescription}
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white h-20"
            placeholderTextColor="#9ca3af"
            multiline
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isPending}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            isPending ? "bg-neutral-200 dark:bg-neutral-800" : "bg-primary-600 dark:bg-accent-600"
          }`}
        >
          <Text className={`text-base font-semibold ${
            isPending ? "text-neutral-400" : "text-white"
          }`}>
            {isPending ? "Saving..." : isEditMode ? "Save Changes" : "Add Expense"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isPending}
          className="w-full items-center justify-center border border-border dark:border-white/15 rounded-2xl py-4"
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
