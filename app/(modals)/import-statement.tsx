import { useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import * as DocumentPicker from "expo-document-picker"
import { statementsApi, StatementFile } from "@/api/endpoints/statements"
import { invalidateTransactionQueries } from "@/api/invalidate"
import { extractErrorMessage } from "@/api/client"
import { useAccounts } from "@/hooks/useAccounts"
import { formatCurrency } from "@/utils/currency"
import { formatDate } from "@/utils/date"
import { maskedDigits } from "@/lib/paymentMethods"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { StatementImportResult } from "@/types/domain"
import { ModalScreen, SectionTitle, InfoRow } from "@/components/layout"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field } from "@/components/ui/misc"

const HOW_TO = [
  "HDFC NetBanking → Accounts → Account Statement",
  "Pick the account and the period (e.g. last month)",
  "Download as Delimited or Excel (XLS) — not PDF",
  "Upload that file here"
]

function Result({ result, onDone, onAnother }: { result: StatementImportResult; onDone: () => void; onAnother: () => void }) {
  const { colors } = useTheme()
  return (
    <>
      <View className="items-center pt-2">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-positive/10">
          <Ionicons name="checkmark" size={24} color={colors.positive} />
        </View>
        <Text className="mt-3 text-base font-semibold">Statement imported</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {result.bank}{result.account_last4 ? ` ${maskedDigits(result.account_last4)}` : ""} · {formatDate(result.period_start)} – {formatDate(result.period_end)}
        </Text>
      </View>

      <Card>
        <InfoRow label="Transactions on statement" value={String(result.rows)} />
        <InfoRow label="Already in the app" value={String(result.matched + result.already_imported)} />
        <InfoRow
          label="Missing — now added"
          value={
            <Text className={cn("text-sm font-medium", result.added > 0 && "text-primary")}>
              {result.added}{Number(result.added_debit_total) > 0 ? ` (${formatCurrency(result.added_debit_total)} spent)` : ""}
            </Text>
          }
        />
        <InfoRow
          label="Balance"
          last
          value={
            result.closing_balance === null
              ? "—"
              : result.balance_updated
                ? `${formatCurrency(result.closing_balance)} · updated`
                : `${formatCurrency(result.closing_balance)} · newer balance kept`
          }
        />
      </Card>

      {result.not_in_statement.length > 0 && (
        <View>
          <SectionTitle title="In the app but not on the statement" />
          <Text className="mb-2 text-xs text-muted-foreground">
            Probably counted twice or linked to the wrong card. Open one to fix or delete it.
          </Text>
          <Card>
            {result.not_in_statement.map((t, i) => (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/(modals)/transaction-detail", params: { id: t.id } })}
                accessibilityRole="button"
                className={cn(
                  "flex-row items-center justify-between px-4 py-3 active:bg-accent web:cursor-pointer web:hover:bg-accent/60",
                  i < result.not_in_statement.length - 1 && "border-b border-border"
                )}
              >
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium">{t.merchant}</Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">{formatDate(t.date)}</Text>
                </View>
                <Text className={cn("text-sm font-medium", t.type === "debit" ? "text-negative" : "text-positive")}>
                  {t.type === "debit" ? "−" : "+"}{formatCurrency(t.amount)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      )}

      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onAnother}>
          <Text>Import another</Text>
        </Button>
        <Button className="flex-1" onPress={onDone}>
          <Text>Done</Text>
        </Button>
      </View>
    </>
  )
}

export default function ImportStatementScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>()
  const { data: accounts, isLoading } = useAccounts()
  const { colors } = useTheme()
  const queryClient = useQueryClient()
  const banks = (accounts ?? []).filter((a) => a.type === "bank")
  const [selected, setSelected] = useState<number | undefined>(accountId ? Number(accountId) : undefined)
  const [file, setFile] = useState<StatementFile | null>(null)
  const [result, setResult] = useState<StatementImportResult | null>(null)
  const account = banks.find((a) => a.id === (selected ?? (banks.length === 1 ? banks[0].id : undefined)))

  const { mutate: upload, isPending, error, reset } = useMutation({
    mutationFn: () => statementsApi.import(account!.id, file!),
    onSuccess: (data) => {
      setResult(data)
      invalidateTransactionQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
      queryClient.invalidateQueries({ queryKey: ["net-worth"] })
    }
  })

  const pick = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["text/plain", "text/csv", "application/vnd.ms-excel", "*/*"],
      copyToCacheDirectory: true
    })
    if (picked.canceled || !picked.assets?.[0]) return
    const asset = picked.assets[0]
    reset()
    setFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, file: (asset as any).file })
  }

  const startOver = () => {
    setResult(null)
    setFile(null)
    reset()
  }

  return (
    <ModalScreen
      title="Import statement"
      footer={
        !result && banks.length > 0 && (
          <Button onPress={() => upload()} loading={isPending} disabled={!account || !file}>
            <Text>Import</Text>
          </Button>
        )
      }
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : result ? (
        <Result result={result} onDone={() => router.back()} onAnother={startOver} />
      ) : banks.length === 0 ? (
        <EmptyState
          icon="card-outline"
          title="Add your debit card first"
          subtitle="A statement is imported into a bank account — add your HDFC debit card with its account number's last 4 digits."
          actionLabel="Add card"
          onAction={() => router.replace("/(modals)/accounts")}
        />
      ) : (
        <>
          <Text className="text-sm text-muted-foreground">
            Your bank statement is the complete record. Importing it adds anything the alerts missed, links what&apos;s already here
            without duplicating it, and sets the balance to the statement&apos;s closing balance.
          </Text>

          {banks.length > 1 && (
            <Field label="Account">
              <ChipGroup
                scroll
                options={banks.map((a) => ({ value: a.id, label: a.name }))}
                value={account?.id ?? -1}
                onChange={setSelected}
              />
            </Field>
          )}

          <Card className="gap-2 p-4">
            <Text className="text-sm font-medium">Download it from HDFC</Text>
            {HOW_TO.map((step, i) => (
              <View key={step} className="flex-row gap-2">
                <Text className="w-4 text-sm text-muted-foreground">{i + 1}.</Text>
                <Text className="flex-1 text-sm text-muted-foreground">{step}</Text>
              </View>
            ))}
          </Card>

          <Field label="Statement file" error={error ? extractErrorMessage(error, "Couldn't import this statement") : undefined}>
            <Pressable
              onPress={pick}
              accessibilityRole="button"
              className="flex-row items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 active:bg-accent web:cursor-pointer web:hover:bg-accent/60"
            >
              <Ionicons name={file ? "document-text-outline" : "cloud-upload-outline"} size={20} color={colors.mutedForeground} />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-medium">{file ? file.name : "Choose file"}</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">{file ? "Tap to change" : ".txt (Delimited) or .xls"}</Text>
              </View>
            </Pressable>
          </Field>
        </>
      )}
    </ModalScreen>
  )
}
