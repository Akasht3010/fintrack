import { View, Pressable, ScrollView, type ScrollViewProps } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { categoryStyle, withAlpha } from "@/lib/categories"
import { Text } from "@/components/ui/text"

/**
 * A tab page: safe-area aware on phones, a centered content column on
 * desktop (the top nav lives in app/(tabs)/_layout.tsx). Pass `scroll={false}`
 * for pages that manage their own list scrolling.
 */
export function Page({
  children,
  scroll = true,
  refreshControl,
  className
}: {
  children: ReactNode
  scroll?: boolean
  refreshControl?: ScrollViewProps["refreshControl"]
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const inner = (
    <View className={cn("w-full flex-1 px-4 pb-6 md:mx-auto md:max-w-[1080px] md:px-8 md:pb-12", className)}>{children}</View>
  )
  return (
    <SafeAreaView edges={isDesktop ? [] : ["top"]} className="flex-1 bg-background">
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <View className="flex-row items-end justify-between gap-4 pb-5 pt-3 md:pb-6 md:pt-8">
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-2xl font-semibold tracking-tight">
          {title}
        </Text>
        {description && <Text className="mt-1 text-sm text-muted-foreground">{description}</Text>}
      </View>
      {actions && <View className="flex-row items-center gap-2">{actions}</View>}
    </View>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-[13px] font-medium text-muted-foreground">{title}</Text>
      {action}
    </View>
  )
}

/** Title bar for a modal screen: title on the left, close on the right. */
export function ModalHeader({ title, onClose = () => router.back(), disabled }: { title: string; onClose?: () => void; disabled?: boolean }) {
  const { colors } = useTheme()
  return (
    <View className="h-14 flex-row items-center justify-between border-b border-border px-4">
      <Text accessibilityRole="header" className="text-base font-semibold">
        {title}
      </Text>
      <Pressable
        onPress={onClose}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        className="h-8 w-8 items-center justify-center rounded-md web:cursor-pointer web:hover:bg-accent"
      >
        <Ionicons name="close" size={20} color={colors.mutedForeground} />
      </Pressable>
    </View>
  )
}

/** A modal screen: header, scrollable body, and an optional pinned footer. */
export function ModalScreen({ title, children, footer, closeDisabled }: { title: string; children: ReactNode; footer?: ReactNode; closeDisabled?: boolean }) {
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <ModalHeader title={title} disabled={closeDisabled} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer && <View className="gap-2 border-t border-border p-4">{footer}</View>}
    </SafeAreaView>
  )
}

/** A neutral circle with the first letter of a name — stands in for logos. */
export function Initial({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-secondary"
    >
      <Text className="font-medium text-muted-foreground" style={{ fontSize: size * 0.4 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  )
}

/** A category's icon on a soft tint of its color — used in lists and headers. */
export function CategoryIcon({ category, size = 36 }: { category: string; size?: number }) {
  const { color, icon } = categoryStyle(category)
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: withAlpha(color, 0.14) }}
      className="items-center justify-center"
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color} />
    </View>
  )
}

/** A label/value row inside a bordered list. */
export function InfoRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View className={cn("min-h-[48px] flex-row items-center justify-between gap-4 px-4 py-3", !last && "border-b border-border")}>
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {typeof value === "string" ? <Text className="flex-shrink text-right text-sm font-medium">{value}</Text> : value}
    </View>
  )
}

/** A tappable settings-style row with a trailing chevron. */
export function LinkRow({ label, icon, onPress, last, destructive }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; last?: boolean; destructive?: boolean }) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        "min-h-[48px] flex-row items-center gap-3 px-4 py-3 active:bg-accent web:cursor-pointer web:hover:bg-accent/60",
        !last && "border-b border-border"
      )}
    >
      {icon && <Ionicons name={icon} size={18} color={destructive ? colors.destructive : colors.mutedForeground} />}
      <Text className={cn("flex-1 text-sm", destructive && "text-destructive")}>{label}</Text>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}
    </Pressable>
  )
}

export { ScrollView }
