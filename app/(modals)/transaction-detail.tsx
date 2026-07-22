import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { useState } from "react"

const SOURCE_LABELS: Record<string, string> = {
  manual: "Added manually",
  gmail: "Imported from Gmail",
  sms: "Imported from SMS",
  aa: "Imported via account aggregator"
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionApi.getById(id),
    enabled: !!id
  })

  const handleDelete = () => {
    Alert.alert(
      "Delete transaction",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true)
            try {
              await transactionApi.delete(id)
              queryClient.invalidateQueries({ queryKey: ["transactions"] })
              router.back()
            } catch (err) {
              setIsDeleting(false)
              Alert.alert("Error", "Failed to delete transaction")
            }
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Transaction</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : error || !transaction ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-neutral-500 dark:text-neutral-400 text-center">Couldn&apos;t load this transaction</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View className="items-center px-6 pt-8 pb-6">
            <View className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/10 items-center justify-center mb-4">
              <Text className="text-3xl">{CATEGORY_ICONS[transaction.category] || "📌"}</Text>
            </View>
            <Text className="text-lg font-semibold text-neutral-900 dark:text-white">{transaction.merchant}</Text>
            <Text
              className={`text-3xl font-bold mt-2 ${
                transaction.type === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-emerald-400"
              }`}
            >
              {transaction.type === "debit" ? "−" : "+"}
              {formatCurrency(transaction.amount, transaction.currency)}
            </Text>
          </View>

          <View className="px-6 mb-6">
            <GlassCard>
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-white/10">
                <Text className="text-sm text-muted dark:text-neutral-400">Category</Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-white capitalize">
                  {transaction.category}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-white/10">
                <Text className="text-sm text-muted dark:text-neutral-400">Date</Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {formatDate(transaction.date)}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-white/10">
                <Text className="text-sm text-muted dark:text-neutral-400">Type</Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-white capitalize">
                  {transaction.type}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-white/10">
                <Text className="text-sm text-muted dark:text-neutral-400">Source</Text>
                <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {SOURCE_LABELS[transaction.source] || transaction.source}
                </Text>
              </View>

              {transaction.is_recurring && (
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-white/10">
                  <Text className="text-sm text-muted dark:text-neutral-400">Recurring</Text>
                  <View className="px-3 py-1 rounded-full bg-primary-100 dark:bg-accent-900">
                    <Text className="text-xs font-medium text-primary-600 dark:text-accent-400">Yes</Text>
                  </View>
                </View>
              )}

              {!!transaction.description && (
                <View className="px-4 py-4">
                  <Text className="text-sm text-muted dark:text-neutral-400 mb-1">Description</Text>
                  <Text className="text-sm text-neutral-900 dark:text-white">{transaction.description}</Text>
                </View>
              )}
            </GlassCard>
          </View>

          <View className="px-6 pb-6 mt-auto gap-3">
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(modals)/add-expense", params: { id: transaction.id } })}
              disabled={isDeleting}
              className="w-full items-center justify-center bg-primary-600 dark:bg-accent-600 rounded-2xl py-4"
            >
              <Text className="text-base font-semibold text-white">Edit Transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              className="w-full items-center justify-center border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 rounded-2xl py-4"
            >
              {isDeleting ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <Text className="text-base font-semibold text-red-600 dark:text-red-400">Delete Transaction</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
