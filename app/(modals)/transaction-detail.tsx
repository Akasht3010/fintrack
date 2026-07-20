import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"

export default function TransactionDetailScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Text className="text-lg font-semibold text-neutral-900">Transaction</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600">✕</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center">
        <Text className="text-neutral-500">Transaction details coming soon</Text>
      </View>
    </SafeAreaView>
  )
}
