import { View, Pressable } from "react-native"
import { router } from "expo-router"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/utils/currency"
import { formatDateShort } from "@/utils/date"
import { Text } from "@/components/ui/text"
import { CategoryIcon } from "./index"
import type { Transaction } from "@/types/domain"

/**
 * One transaction in a bordered list: category icon, merchant, and the
 * amount in green (income) or red (expense).
 * `wide` adds a category column for desktop tables.
 */
export function TransactionRow({ transaction, last, wide, showDate = true }: { transaction: Transaction; last?: boolean; wide?: boolean; showDate?: boolean }) {
  const isCredit = transaction.type === "credit"
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(modals)/transaction-detail", params: { id: transaction.id } })}
      accessibilityRole="button"
      className={cn(
        "min-h-[60px] flex-row items-center gap-3 px-4 py-3 active:bg-accent web:cursor-pointer web:hover:bg-accent/60",
        !last && "border-b border-border"
      )}
    >
      <CategoryIcon category={transaction.category} />
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium">
          {transaction.merchant}
        </Text>
        {!wide && (
          <Text numberOfLines={1} className="mt-0.5 text-xs capitalize text-muted-foreground">
            {transaction.category}
            {showDate ? ` · ${formatDateShort(transaction.date)}` : ""}
          </Text>
        )}
      </View>
      {wide && (
        <>
          <Text numberOfLines={1} className="w-36 text-[13px] capitalize text-muted-foreground">
            {transaction.category}
          </Text>
          {showDate && <Text className="w-20 text-[13px] text-muted-foreground">{formatDateShort(transaction.date)}</Text>}
        </>
      )}
      <Text className={cn("text-sm font-medium", wide && "w-28 text-right", isCredit ? "text-positive" : "text-negative")}>
        {isCredit ? "+" : "−"}
        {formatCurrency(transaction.amount)}
      </Text>
    </Pressable>
  )
}
