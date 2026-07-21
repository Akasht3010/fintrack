import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useUserStore } from "@/store/useUserStore"
import { useCreateTransaction } from "@/hooks/useCreateTransaction"
import { useState } from "react"

const CATEGORIES = [
  "food", "transport", "shopping", "entertainment",
  "health", "utilities", "rent", "subscriptions", "transfer", "other"
]

export default function AddExpenseScreen() {
  const { user } = useUserStore()
  const { mutate: createTransaction, isPending } = useCreateTransaction()

  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [description, setDescription] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("food")

  const handleAdd = () => {
    if (!amount.trim()) {
      Alert.alert("Error", "Please enter an amount")
      return
    }

    if (!merchant.trim()) {
      Alert.alert("Error", "Please enter merchant name")
      return
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found")
      return
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
      onSuccess: () => {
        router.back()
      },
      onError: (error: any) => {
        Alert.alert("Error", "Failed to add expense")
      }
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Text className="text-lg font-semibold text-neutral-900">Add Expense</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        {/* Amount */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 mb-2">Amount</Text>
          <View className="flex-row items-center border border-border rounded-2xl px-4">
            <Text className="text-2xl font-bold text-neutral-900">₹</Text>
            <TextInput
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              className="flex-1 py-4 px-3 text-xl font-bold text-neutral-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Merchant */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 mb-2">Merchant</Text>
          <TextInput
            placeholder="e.g., Swiggy, Uber, etc."
            value={merchant}
            onChangeText={setMerchant}
            className="border border-border rounded-2xl px-4 py-3 text-base text-neutral-900"
            placeholderTextColor="#9ca3af"
          />
        </View>

        {/* Category */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === cat
                    ? "bg-primary-600"
                    : "bg-neutral-100"
                }`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${
                    selectedCategory === cat
                      ? "text-white"
                      : "text-neutral-700"
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
          <Text className="text-sm font-medium text-neutral-900 mb-2">Description (optional)</Text>
          <TextInput
            placeholder="Add notes"
            value={description}
            onChangeText={setDescription}
            className="border border-border rounded-2xl px-4 py-3 text-base text-neutral-900 h-20"
            placeholderTextColor="#9ca3af"
            multiline
          />
        </View>
      </ScrollView>

      {/* Add Button */}
      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          onPress={handleAdd}
          disabled={isPending}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            isPending ? "bg-neutral-200" : "bg-primary-600"
          }`}
        >
          <Text className={`text-base font-semibold ${
            isPending ? "text-neutral-400" : "text-white"
          }`}>
            {isPending ? "Adding..." : "Add Expense"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isPending}
          className="w-full items-center justify-center border border-border rounded-2xl py-4"
        >
          <Text className="text-base font-semibold text-neutral-900">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
