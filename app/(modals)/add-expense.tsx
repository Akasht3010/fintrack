import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useUserStore } from "@/store/useUserStore"
import { useCreateTransaction } from "@/hooks/useCreateTransaction"
import { useCategories } from "@/hooks/useCategories"
import { useAccounts } from "@/hooks/useAccounts"
import { transactionApi } from "@/api/endpoints/transactions"
import { budgetApi } from "@/api/endpoints/budgets"
import { Budget } from "@/types/domain"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { Chip } from "@/components/shared/Chip"
import { useState, useEffect } from "react"

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const transactionId = id ? Number(id) : undefined
  const isEditMode = !!id
  const { user } = useUserStore()
  const { mutate: createTransaction, isPending: isCreating } = useCreateTransaction()
  const [transactionType, setTransactionType] = useState<"debit" | "credit">("debit")
  // Credit gets every category (same expense list plus the income-only
  // ones) — a credit isn't always pure income (e.g. a refund logically
  // belongs under the same category the original expense used).
  const { data: categories } = useCategories(transactionType === "credit" ? undefined : "expense")
  const { data: accounts } = useAccounts()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionApi.getById(transactionId!),
    enabled: isEditMode
  })

  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [description, setDescription] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("food")
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined)

  // The category list is scoped to the current type (expense vs income), so
  // switching the toggle can leave selectedCategory pointing at a name from
  // the other list — fall back to the first category the new list actually has.
  useEffect(() => {
    if (categories?.length && !categories.some(c => c.name === selectedCategory)) {
      setSelectedCategory(categories[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  useEffect(() => {
    if (existing) {
      setAmount(String(existing.amount))
      setMerchant(existing.merchant)
      setDescription(existing.description === existing.merchant ? "" : existing.description)
      setSelectedCategory(existing.category)
      setTransactionType(existing.type)
      setSelectedAccountId(existing.account_id ?? undefined)
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
        await transactionApi.update(transactionId!, {
          amount: parseFloat(amount),
          type: transactionType,
          category: selectedCategory,
          merchant,
          description: description || merchant,
          account_id: selectedAccountId ?? null
        })
        queryClient.invalidateQueries({ queryKey: ["transactions"] })
        queryClient.invalidateQueries({ queryKey: ["transaction", id] })
        queryClient.invalidateQueries({ queryKey: ["budgets"] })
        queryClient.invalidateQueries({ queryKey: ["net-worth"] })
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
    if (transactionType === "debit") {
      try {
        budgetsBefore = await budgetApi.list()
      } catch {
        // Alerting is best-effort — don't block adding the expense over this
      }
    }

    createTransaction({
      amount: parseFloat(amount),
      type: transactionType,
      category: selectedCategory,
      merchant,
      description: description || merchant,
      date: new Date().toISOString(),
      source: "manual",
      is_recurring: false,
      account_id: selectedAccountId ?? null
    }, {
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ["net-worth"] })
        if (transactionType === "debit") {
          try {
            const budgetsAfter = await budgetApi.list()
            await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
            queryClient.invalidateQueries({ queryKey: ["budgets"] })
          } catch {
            // Same — never let alerting get in the way of the actual save
          }
        }
        router.back()
      },
      onError: (error: any) => {
        console.log("Add transaction failed:", error?.response?.status, error?.response?.data, error?.message)
        const detail = error?.response?.data?.detail
        Alert.alert(
          "Error",
          detail || `Failed to add ${transactionType === "credit" ? "credit" : "expense"} (${error?.message || "unknown error"})`
        )
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
          {isEditMode ? "Edit Transaction" : transactionType === "credit" ? "Add Credit" : "Add Expense"}
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="cursor-pointer hover:opacity-70 transition-opacity duration-150">
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Type toggle */}
        <View className="flex-row bg-neutral-100 dark:bg-white/10 rounded-2xl p-1 mb-6">
          {(["debit", "credit"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTransactionType(t)}
              className={`flex-1 items-center py-2 rounded-xl cursor-pointer transition-colors duration-150 ${
                transactionType === t ? "bg-white dark:bg-white/20" : "hover:bg-white/50 dark:hover:bg-white/10"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  transactionType === t
                    ? "text-neutral-900 dark:text-white"
                    : "text-muted dark:text-neutral-400"
                }`}
              >
                {t === "debit" ? "Expense" : "Credit"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {/* Merchant / Source */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
            {transactionType === "credit" ? "Source" : "Merchant"}
          </Text>
          <TextInput
            placeholder={transactionType === "credit" ? "e.g., Salary, Freelance, etc." : "e.g., Swiggy, Uber, etc."}
            value={merchant}
            onChangeText={setMerchant}
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Account */}
        {!!accounts?.length && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Account (optional)</Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip label="None" selected={!selectedAccountId} onPress={() => setSelectedAccountId(undefined)} capitalize={false} />
              {accounts.map((acc) => (
                <Chip
                  key={acc.id}
                  label={acc.name}
                  selected={selectedAccountId === acc.id}
                  onPress={() => setSelectedAccountId(acc.id)}
                  capitalize={false}
                />
              ))}
            </View>
          </View>
        )}

        {/* Category */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
            {transactionType === "credit" ? "Received as" : "Category"}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {categories?.map((cat) => (
              <Chip
                key={cat.id}
                label={`${cat.icon} ${cat.name}`}
                selected={selectedCategory === cat.name}
                onPress={() => setSelectedCategory(cat.name)}
              />
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
            isPending
              ? "bg-neutral-200 dark:bg-neutral-800"
              : "bg-primary-600 dark:bg-accent-600 cursor-pointer hover:opacity-90 transition-opacity duration-150"
          }`}
        >
          <Text className={`text-base font-semibold ${
            isPending ? "text-neutral-400" : "text-white"
          }`}>
            {isPending
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : transactionType === "credit" ? "Add Credit" : "Add Expense"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isPending}
          className="w-full items-center justify-center border border-border dark:border-white/15 rounded-2xl py-4 cursor-pointer transition-colors duration-150 hover:bg-neutral-50 dark:hover:bg-white/5"
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
