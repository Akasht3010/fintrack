import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

interface EmptyStateProps {
  icon?: string
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = "📭", title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary">
        <Text className="text-2xl">{icon}</Text>
      </View>
      <Text className="text-center text-base font-semibold">{title}</Text>
      {subtitle && (
        <Text className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">{subtitle}</Text>
      )}
      {/* Optional — not every call site has one obvious next action (a
          filtered "no matches" state shouldn't offer to add a
          transaction, for instance), so this stays opt-in. */}
      {actionLabel && onAction && (
        <Button onPress={onAction} size="sm" className="mt-5 px-4">
          <Text>{actionLabel}</Text>
        </Button>
      )}
    </View>
  )
}
