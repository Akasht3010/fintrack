import { View, Text } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BrandMark } from "./BrandMark"

const POINTS = [
  { icon: "layers-outline" as const, text: "Manual, Gmail, and SMS transactions in one ledger" },
  { icon: "shield-checkmark-outline" as const, text: "Gmail tokens encrypted at rest, two-factor login" },
  { icon: "trending-up-outline" as const, text: "Budgets and multi-currency insights that stay current" }
]

/**
 * Desktop-only left pane for the (auth) group (see app/(auth)/_layout.tsx) —
 * gives the wide half of the screen the auth card doesn't need something to
 * say, instead of leaving it as empty ambient glow. Mirrors the marketing
 * site's hero copy/brand mark so the app doesn't visually reset the moment
 * someone arrives from fintrack-web.
 */
export function AuthBrandPanel() {
  return (
    <View className="flex-1 justify-center px-16 max-w-[560px]">
      <BrandMark size={56} />
      <Text className="text-4xl font-bold text-white mt-8 leading-tight">
        All your money.{"\n"}One honest ledger.
      </Text>
      <Text className="text-base text-neutral-400 mt-5 leading-6 max-w-[420px]">
        Manual entries, Gmail bank alerts, and SMS — unified, categorized, and budgeted, without the spreadsheet.
      </Text>

      <View className="mt-10 gap-5">
        {POINTS.map((point) => (
          <View key={point.text} className="flex-row items-start gap-3">
            <View className="w-8 h-8 rounded-full bg-primary-500/15 items-center justify-center mt-0.5">
              <Ionicons name={point.icon} size={16} color="#4ade80" />
            </View>
            <Text className="flex-1 text-sm text-neutral-300 leading-5 mt-1.5">{point.text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
