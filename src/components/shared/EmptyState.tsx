import { View, Text, TouchableOpacity } from "react-native"

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
      <Text className="text-4xl mb-3">{icon}</Text>
      <Text className="text-base font-semibold text-neutral-900 dark:text-white text-center">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-muted dark:text-neutral-400 text-center mt-1 max-w-[320px]">{subtitle}</Text>
      )}
      {/* Optional — a first-run empty state with nothing to click is
          especially stark on a wide desktop window, where it's the only
          thing on an otherwise-empty page. Not every call site has one
          single obvious next action (a filtered "no matches" state
          shouldn't offer to add a transaction, for instance), so this
          stays opt-in rather than always rendering a button. */}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="mt-5 px-6 py-3 rounded-2xl bg-primary-600 dark:bg-accent-600 cursor-pointer transition-opacity duration-150 hover:opacity-90"
        >
          <Text className="text-sm font-semibold text-white">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
