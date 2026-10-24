import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { Text } from "@/components/ui/text"
import { Badge } from "@/components/ui/misc"
import { FadeIn } from "@/components/effects/FadeIn"
import { BrandMark } from "./BrandMark"

const POINTS = [
  { icon: "layers-outline" as const, title: "One ledger", text: "Manual, Gmail and SMS transactions together." },
  { icon: "shield-checkmark-outline" as const, title: "Private by default", text: "Encrypted Gmail tokens and two-factor sign-in." },
  { icon: "trending-up-outline" as const, title: "Always current", text: "Budgets and insights that update as you spend." }
]

/**
 * Desktop-only left pane for the (auth) group (see app/(auth)/_layout.tsx),
 * so the half of the window the sign-in card doesn't need carries the
 * product pitch instead of empty space.
 */
export function AuthBrandPanel() {
  const { colors } = useTheme()

  return (
    <View className="max-w-[520px] flex-1 justify-center px-10">
      <FadeIn>
        <View className="flex-row items-center gap-2.5">
          <BrandMark size={36} />
          <Text className="text-lg font-semibold tracking-tight">Fintrack</Text>
        </View>
      </FadeIn>

      <FadeIn delay={80}>
        <Badge variant="outline" className="mt-10 gap-1.5 bg-background/70">
          <View className="h-1.5 w-1.5 rounded-full bg-primary" />
          <Text>Personal finance, without the spreadsheet</Text>
        </Badge>
      </FadeIn>

      <FadeIn delay={160}>
        <Text className="mt-5 text-5xl font-bold leading-[56px] tracking-tighter">
          Every rupee,{"\n"}
          <Text className="text-5xl font-bold leading-[56px] tracking-tighter text-primary">in one clear view.</Text>
        </Text>
      </FadeIn>

      <FadeIn delay={240}>
        <Text className="mt-5 max-w-[440px] text-base leading-7 text-muted-foreground">
          Fintrack pulls your bank alerts, card spends and manual entries into a single, categorized
          ledger — with budgets that roll forward on their own.
        </Text>
      </FadeIn>

      <View className="mt-10 gap-5">
        {POINTS.map((point, i) => (
          <FadeIn key={point.title} delay={320 + i * 80}>
            <View className="flex-row items-start gap-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-card">
                <Ionicons name={point.icon} size={17} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold">{point.title}</Text>
                <Text className="mt-0.5 text-sm text-muted-foreground">{point.text}</Text>
              </View>
            </View>
          </FadeIn>
        ))}
      </View>
    </View>
  )
}
