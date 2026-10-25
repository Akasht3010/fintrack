import { View, ActivityIndicator } from "react-native"
import { useQuery } from "@tanstack/react-query"
import dayjs from "dayjs"
import { recurringApi } from "@/api/endpoints/recurring"
import { formatCurrency } from "@/utils/currency"
import { formatDate, formatRelative } from "@/utils/date"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { ModalScreen, CategoryIcon } from "@/components/layout"
import { Card } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import { RecurringCadence } from "@/types/domain"

const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly"
}

export default function RecurringScreen() {
  const { colors } = useTheme()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["recurring"],
    queryFn: ({ signal }) => recurringApi.summary(signal)
  })

  return (
    <ModalScreen title="Subscriptions">
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load subscriptions" onRetry={refetch} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon="repeat-outline"
          title="Nothing recurring yet"
          subtitle="Once a merchant charges you on a regular cadence a few times, it'll show up here."
        />
      ) : (
        <>
          <View>
            <Text className="text-[13px] text-muted-foreground">Estimated monthly cost</Text>
            <Text className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(data.monthly_total)}</Text>
          </View>

          <Card>
            {data.items.map((item, i) => {
              const isOverdue = dayjs(item.next_due_date).isBefore(dayjs())
              return (
                <View key={item.merchant} className={cn("flex-row items-center gap-3 px-4 py-3", i < data.items.length - 1 && "border-b border-border")}>
                  <CategoryIcon category={item.category} />
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-sm font-medium">{item.merchant}</Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {CADENCE_LABELS[item.cadence]} · last {formatDate(item.last_date)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm font-medium">{formatCurrency(item.average_amount)}</Text>
                    <Text className={cn("mt-0.5 text-xs", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                      {isOverdue ? "Due" : "Next"} {formatRelative(item.next_due_date)}
                    </Text>
                  </View>
                </View>
              )
            })}
          </Card>
        </>
      )}
    </ModalScreen>
  )
}
