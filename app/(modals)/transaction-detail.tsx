import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { transactionApi } from "@/api/endpoints/transactions"
import { formatCurrency } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
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
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Text className="text-lg font-semibold text-neutral-900">Transaction</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600">✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : error || !transaction ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-neutral-500 text-center">Couldn&apos;t load this transaction</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View className="items-center px-6 pt-8 pb-6">
            <View className="w-16 h-16 rounded-full bg-neutral-100 items-center justify-center mb-4">
              <Text className="text-3xl">{CATEGORY_ICONS[transaction.category] || "📌"}</Text>
            </View>
            <Text className="text-lg font-semibold text-neutral-900">{transaction.merchant}</Text>
            <Text
              className={`text-3xl font-bold mt-2 ${
                transaction.type === "debit" ? "text-red-600" : "text-green-600"
              }`}
            >
              {transaction.type === "debit" ? "−" : "+"}
              {formatCurrency(transaction.amount, transaction.currency)}
            </Text>
          </View>

          <View className="px-6 mb-6">
            <View className="bg-white border border-border rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-sm text-muted">Category</Text>
                <Text className="text-sm font-semibold text-neutral-900 capitalize">
                  {transaction.category}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-sm text-muted">Date</Text>
                <Text className="text-sm font-semibold text-neutral-900">
                  {formatDate(transaction.date)}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-sm text-muted">Type</Text>
                <Text className="text-sm font-semibold text-neutral-900 capitalize">
                  {transaction.type}
                </Text>
              </View>

              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-sm text-muted">Source</Text>
                <Text className="text-sm font-semibold text-neutral-900">
                  {SOURCE_LABELS[transaction.source] || transaction.source}
                </Text>
              </View>

              {transaction.is_recurring && (
                <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                  <Text className="text-sm text-muted">Recurring</Text>
                  <View className="px-3 py-1 rounded-full bg-primary-100">
                    <Text className="text-xs font-medium text-primary-600">Yes</Text>
                  </View>
                </View>
              )}

              {!!transaction.description && (
                <View className="px-4 py-4">
                  <Text className="text-sm text-muted mb-1">Description</Text>
                  <Text className="text-sm text-neutral-900">{transaction.description}</Text>
                </View>
              )}
            </View>
          </View>

          <View className="px-6 pb-6 mt-auto gap-3">
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(modals)/add-expense", params: { id: transaction.id } })}
              disabled={isDeleting}
              className="w-full items-center justify-center bg-primary-600 rounded-2xl py-4"
            >
              <Text className="text-base font-semibold text-white">Edit Transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              className="w-full items-center justify-center border border-red-200 bg-red-50 rounded-2xl py-4"
            >
              {isDeleting ? (
                <ActivityIndicator color="#dc2626" />
              ) : (
                <Text className="text-base font-semibold text-red-600">Delete Transaction</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
