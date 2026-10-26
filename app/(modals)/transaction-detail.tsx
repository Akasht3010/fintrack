import { View, ActivityIndicator } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { transactionApi } from "@/api/endpoints/transactions"
import { invalidateTransactionQueries } from "@/api/invalidate"
import { showAlert } from "@/utils/alert"
import { formatCurrency } from "@/utils/currency"
import { formatDateTime } from "@/utils/date"
import { confirm } from "@/utils/confirm"
import { useTheme } from "@/lib/theme"
import { useAccounts } from "@/hooks/useAccounts"
import { ModalScreen, InfoRow, CategoryIcon } from "@/components/layout"
import { cn } from "@/lib/utils"
import { maskedDigits, paymentMethodLabel } from "@/lib/paymentMethods"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Text } from "@/components/ui/text"

const SOURCE_LABELS: Record<string, string> = {
  manual: "Added manually",
  gmail: "Imported from Gmail",
  sms: "Imported from SMS",
  aa: "Imported via account aggregator"
}

export default function TransactionDetailScreen() {
  const { data: accounts } = useAccounts(true)
  const { id } = useLocalSearchParams<{ id: string }>()
  const transactionId = Number(id)
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: ({ signal }) => transactionApi.getById(transactionId, signal),
    enabled: !!id
  })

  const handleDelete = async () => {
    const confirmed = await confirm("Delete transaction", "This can't be undone.", {
      confirmLabel: "Delete",
      destructive: true
    })
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await transactionApi.delete(transactionId)
      invalidateTransactionQueries(queryClient)
      router.back()
    } catch {
      setIsDeleting(false)
      showAlert("Error", "Failed to delete transaction")
    }
  }

  const accountName = transaction?.account_id ? accounts?.find(a => a.id === transaction.account_id)?.name : undefined
  const hintedDigits = transaction?.account_hint?.split(",")[0]

  return (
    <ModalScreen
      title="Transaction"
      footer={
        transaction && (
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={handleDelete} loading={isDeleting}>
              <Text className="text-destructive">Delete</Text>
            </Button>
            <Button
              className="flex-1"
              disabled={isDeleting}
              onPress={() => router.push({ pathname: "/(modals)/add-expense", params: { id: transaction.id } })}
            >
              <Text>Edit</Text>
            </Button>
          </View>
        )
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error || !transaction ? (
        <View className="flex-1 items-center justify-center py-16">
          <Text className="text-center text-muted-foreground">Couldn&apos;t load this transaction</Text>
        </View>
      ) : (
        <>
          <View className="items-center pt-4">
            <CategoryIcon category={transaction.category} size={52} />
            <Text className="mt-3 text-base font-medium">{transaction.merchant}</Text>
            <Text className={cn("mt-1 text-3xl font-semibold tracking-tight", transaction.type === "debit" ? "text-negative" : "text-positive")}>
              {transaction.type === "debit" ? "−" : "+"}
              {formatCurrency(transaction.amount)}
            </Text>
          </View>

          <Card>
            <InfoRow label="Category" value={<Text className="text-sm font-medium capitalize">{transaction.category}</Text>} />
            <InfoRow label="Date" value={formatDateTime(transaction.date)} />
            <InfoRow label="Type" value={transaction.type === "debit" ? "Expense" : "Income"} />
            <InfoRow label="Source" value={SOURCE_LABELS[transaction.source] || transaction.source} />
            {!!transaction.payment_method && <InfoRow label="Paid via" value={paymentMethodLabel(transaction.payment_method)} />}
            {transaction.account_id ? (
              <InfoRow label="Account" value={accountName || "—"} />
            ) : hintedDigits ? (
              <InfoRow
                label="Account"
                value={
                  <Text
                    onPress={() => router.push("/(modals)/accounts")}
                    className="text-sm font-medium text-primary web:cursor-pointer"
                  >
                    {maskedDigits(hintedDigits)} · add this account
                  </Text>
                }
              />
            ) : null}
            {transaction.is_recurring && <InfoRow label="Recurring" value="Yes" />}
            {!!transaction.description && (
              <View className="gap-1 px-4 py-3">
                <Text className="text-sm text-muted-foreground">Note</Text>
                <Text className="text-sm">{transaction.description}</Text>
              </View>
            )}
          </Card>
        </>
      )}
    </ModalScreen>
  )
}
