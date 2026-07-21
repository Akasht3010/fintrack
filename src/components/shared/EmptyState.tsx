import { View, Text } from "react-native"

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
}

export function EmptyState({ icon = "📭", title, subtitle }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Text className="text-4xl mb-3">{icon}</Text>
      <Text className="text-base font-semibold text-neutral-900 dark:text-white text-center">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-muted dark:text-neutral-400 text-center mt-1">{subtitle}</Text>
      )}
    </View>
  )
}
