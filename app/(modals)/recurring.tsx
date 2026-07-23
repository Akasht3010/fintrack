import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import { recurringApi } from "@/api/endpoints/recurring"
import { formatCurrency } from "@/utils/currency"
import { formatDate, formatRelative } from "@/utils/date"
import { Colors } from "@/constants/colors"
import { CATEGORY_ICONS } from "@/constants/categories"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { RecurringCadence } from "@/types/domain"

const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly"
}

export default function RecurringScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringApi.summary()
  })

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Subscriptions</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={Colors.primary[600]} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load subscriptions" onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon="🔁"
          title="Nothing recurring yet"
          subtitle="Once a merchant charges you on a regular cadence a few times, it'll show up here."
        />
      ) : (
        <ScrollView className="px-6 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6">
            <Text className="text-sm text-muted dark:text-neutral-400">Estimated monthly cost</Text>
            <Text className="text-4xl font-bold text-neutral-900 dark:text-white mt-1">
              {formatCurrency(data.monthly_total)}
            </Text>
          </View>

          <View className="gap-3 pb-8">
            {data.items.map((item) => {
              const isOverdue = dayjs(item.next_due_date).isBefore(dayjs())
              return (
                <GlassCard key={item.merchant} className="p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-white/10 items-center justify-center">
                        <Text className="text-lg">{CATEGORY_ICONS[item.category] || "📌"}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {item.merchant}
                        </Text>
                        <Text className="text-xs text-muted dark:text-neutral-400 capitalize mt-0.5">
                          {CADENCE_LABELS[item.cadence]} • {item.occurrences} charges seen
                        </Text>
                      </View>
                    </View>
                    <Text className="text-sm font-bold text-neutral-900 dark:text-white">
                      {formatCurrency(item.average_amount)}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between pt-3 border-t border-border dark:border-white/10">
                    <Text className="text-xs text-muted dark:text-neutral-400">
                      Last charged {formatDate(item.last_date)}
                    </Text>
                    <Text className={`text-xs font-medium ${isOverdue ? "text-red-600 dark:text-red-400" : "text-primary-600 dark:text-accent-400"}`}>
                      {isOverdue ? "Due" : "Next"} {formatRelative(item.next_due_date)}
                    </Text>
                  </View>
                </GlassCard>
              )
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
