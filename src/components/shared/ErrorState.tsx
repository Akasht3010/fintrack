import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  const { colors } = useTheme()
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Ionicons name="alert-circle-outline" size={28} color={colors.mutedForeground} />
      <Text className="mt-3 text-center text-[15px] font-medium">{message}</Text>
      {onRetry && (
        <Button onPress={onRetry} variant="outline" size="sm" className="mt-4">
          <Text>Try again</Text>
        </Button>
      )}
    </View>
  )
}
