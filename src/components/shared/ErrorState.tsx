import { View, Text, TouchableOpacity } from "react-native"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="text-4xl mb-3">⚠️</Text>
      <Text className="text-base font-semibold text-neutral-900 text-center">{message}</Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="mt-4 px-6 py-3 rounded-2xl bg-primary-600"
        >
          <Text className="text-sm font-semibold text-white">Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
