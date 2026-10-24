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
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <Ionicons name="alert-circle-outline" size={26} color={colors.destructive} />
      </View>
      <Text className="text-center text-base font-semibold">{message}</Text>
      {onRetry && (
        <Button onPress={onRetry} variant="outline" size="sm" className="mt-4 px-4">
          <Ionicons name="refresh" size={14} color={colors.foreground} />
          <Text>Try again</Text>
        </Button>
      )}
    </View>
  )
}
