import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = "file-tray-outline", title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme()
  return (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <Ionicons name={icon} size={28} color={colors.mutedForeground} />
      <Text className="mt-3 text-center text-[15px] font-medium">{title}</Text>
      {subtitle && <Text className="mt-1 max-w-[320px] text-center text-sm text-muted-foreground">{subtitle}</Text>}
      {/* Optional — not every call site has one obvious next action (a
          filtered "no matches" state shouldn't offer to add a
          transaction, for instance), so this stays opt-in. */}
      {actionLabel && onAction && (
        <Button onPress={onAction} variant="outline" size="sm" className="mt-4">
          <Text>{actionLabel}</Text>
        </Button>
      )}
    </View>
  )
}
