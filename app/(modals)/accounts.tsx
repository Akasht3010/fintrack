import { useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { accountsApi } from "@/api/endpoints/accounts"
import { useAccounts } from "@/hooks/useAccounts"
import { formatCurrency } from "@/utils/currency"
import { parseMoneyInput, toDecimal } from "@/utils/money"
import { formatRelative } from "@/utils/date"
import { Account, AccountType } from "@/types/domain"
import { confirm } from "@/utils/confirm"
import { extractErrorMessage as errorDetail } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { BANKS } from "@/lib/banks"
import { maskedDigits } from "@/lib/paymentMethods"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { ModalScreen, SectionTitle } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field, Segmented } from "@/components/ui/misc"

type CardKind = "debit" | "credit"

// A debit card is tracked as its bank account ("bank"): UPI and most bank
// alerts quote the account number, card swipes quote the card number, so
// it holds both. A credit card is its own account, known by the card number.
const KIND_TO_TYPE: Record<CardKind, AccountType> = { debit: "bank", credit: "credit_card" }

const LEGACY_TYPE_LABELS: Partial<Record<AccountType, string>> = {
  cash: "Cash",
  wallet: "Wallet",
  investment: "Investment"
}

// Bank alerts print only the last 3–4 digits ("A/c XX1234", "Card ending 9876").
const DIGITS_RE = /^\d{3,4}$/

function digitsError(value: string): string | false {
  return value.trim() && !DIGITS_RE.test(value.trim()) ? "Enter the last 3 or 4 digits" : false
}

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["net-worth"] })
  // Adding/editing digits claims matching past imports.
  queryClient.invalidateQueries({ queryKey: ["transactions"] })
  queryClient.invalidateQueries({ queryKey: ["insights"] })
}

function kindOf(account: Account): CardKind | null {
  return account.type === "bank" ? "debit" : account.type === "credit_card" ? "credit" : null
}

function describe(account: Account): string {
  const kind = kindOf(account)
  const parts: string[] = []
  if (account.institution) parts.push(account.institution)
  if (kind === "debit") {
    parts.push("Debit card")
    if (account.last4) parts.push(`A/c ${maskedDigits(account.last4)}`)
    if (account.card_last4) parts.push(`card ${maskedDigits(account.card_last4)}`)
  } else if (kind === "credit") {
    parts.push("Credit card")
    if (account.last4) parts.push(maskedDigits(account.last4))
  } else {
    parts.push(LEGACY_TYPE_LABELS[account.type] ?? account.type)
  }
  if (account.is_archived) parts.push("Archived")
  return parts.join(" · ")
}

/** Bank + last-4 fields shared by the add and edit forms. */
function CardFields({
  kind, bank, setBank, accountDigits, setAccountDigits, cardDigits, setCardDigits
}: {
  kind: CardKind
  bank: string
  setBank: (v: string) => void
  accountDigits: string
  setAccountDigits: (v: string) => void
  cardDigits: string
  setCardDigits: (v: string) => void
}) {
  const [other, setOther] = useState(!!bank && !BANKS.includes(bank))
  return (
    <>
      <Field label="Bank">
        <ChipGroup
          scroll
          options={[...BANKS.map((b) => ({ value: b, label: b })), { value: "__other", label: "Other" }]}
          value={other ? "__other" : bank}
          onChange={(v) => {
            setOther(v === "__other")
            setBank(v === "__other" ? "" : v)
          }}
        />
        {other && <Input value={bank} onChangeText={setBank} placeholder="Bank name" accessibilityLabel="Bank name" autoFocus />}
      </Field>
      <Field label="Card number — last 4 digits" error={digitsError(cardDigits)}>
        <Input
          value={cardDigits}
          onChangeText={setCardDigits}
          invalid={!!digitsError(cardDigits)}
          placeholder="9876"
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Card number last 4 digits"
        />
      </Field>
      {kind === "debit" && (
        <Field
          label="Account number — last 4 digits"
          error={digitsError(accountDigits)}
          hint="UPI and bank alerts quote the account number (A/c XX1234), not the card — add it so those payments land here."
        >
          <Input
            value={accountDigits}
            onChangeText={setAccountDigits}
            invalid={!!digitsError(accountDigits)}
            placeholder="1234"
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel="Account number last 4 digits"
          />
        </Field>
      )}
    </>
  )
}

/** Credit → last4 is the card. Debit → last4 is the account, card_last4 the card. */
function digitsPayload(kind: CardKind, accountDigits: string, cardDigits: string) {
  const acct = accountDigits.trim() || null
  const card = cardDigits.trim() || null
  return kind === "credit" ? { last4: card, card_last4: null } : { last4: acct, card_last4: card }
}

function AccountRow({ account, last }: { account: Account; last: boolean }) {
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const kind = kindOf(account)
  const isCreditCard = account.type === "credit_card"
  const initialAccountDigits = kind === "debit" ? account.last4 ?? "" : ""
  const initialCardDigits = (kind === "credit" ? account.last4 : account.card_last4) ?? ""
  const [mode, setMode] = useState<"view" | "edit" | "balance">("view")
  const [name, setName] = useState(account.name)
  const [bank, setBank] = useState(account.institution ?? "")
  const [accountDigits, setAccountDigits] = useState(initialAccountDigits)
  const [cardDigits, setCardDigits] = useState(initialCardDigits)
  const [currentBalance, setCurrentBalance] = useState("")

  const resetForm = () => {
    setName(account.name)
    setBank(account.institution ?? "")
    setAccountDigits(initialAccountDigits)
    setCardDigits(initialCardDigits)
    setCurrentBalance("")
    setMode("view")
  }

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: () =>
      accountsApi.update(account.id, {
        name: name.trim(),
        ...(kind ? { institution: bank.trim() || null, ...digitsPayload(kind, accountDigits, cardDigits) } : {})
      }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setMode("view")
    },
    onError: (error: any) => showAlert("Couldn't save", errorDetail(error, "Failed to update"))
  })

  const { mutate: setBalance, isPending: isSettingBalance } = useMutation({
    mutationFn: (balance: number) => accountsApi.setBalance(account.id, balance),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setCurrentBalance("")
      setMode("view")
    },
    onError: (error: any) => showAlert("Couldn't save", errorDetail(error, "Failed to update balance"))
  })

  const { mutate: archive, isPending: isArchiving } = useMutation({
    mutationFn: () => accountsApi.update(account.id, { is_archived: !account.is_archived }),
    onSuccess: () => invalidateAccountQueries(queryClient),
    onError: (error: any) => showAlert("Error", errorDetail(error, "Failed to update"))
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => accountsApi.remove(account.id),
    onSuccess: () => invalidateAccountQueries(queryClient),
    onError: (error: any) => showAlert("Couldn't delete", errorDetail(error, "Failed to delete"))
  })

  const handleDelete = async () => {
    const confirmed = await confirm("Delete", `Delete "${account.name}"? This can't be undone.`, {
      confirmLabel: "Delete",
      destructive: true
    })
    if (confirmed) remove()
  }

  const handleSetBalance = () => {
    const parsed = parseMoneyInput(currentBalance)
    if (parsed === null) {
      showAlert("Error", "Please enter the balance as a number")
      return
    }
    setBalance(parsed)
  }

  const balance = toDecimal(account.balance)
  const known = account.balance_known !== false

  if (mode === "balance") {
    return (
      <View className={cn("gap-3 p-4", !last && "border-b border-border")}>
        <Field
          label={isCreditCard ? `Amount owed on ${account.name}` : `Current balance of ${account.name}`}
          hint={isCreditCard ? "As shown in your card app or statement." : "As shown in your bank app, or 'Check balance' in Google Pay / your UPI app."}
        >
          <Input
            value={currentBalance}
            onChangeText={setCurrentBalance}
            keyboardType="decimal-pad"
            autoFocus
            placeholder={known ? balance.toFixed(2) : "0.00"}
            accessibilityLabel="Current balance"
            leading={<Text className="text-sm text-muted-foreground">₹</Text>}
          />
        </Field>
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" disabled={isSettingBalance} onPress={resetForm}>
            <Text>Cancel</Text>
          </Button>
          <Button size="sm" className="flex-1" onPress={handleSetBalance} loading={isSettingBalance} disabled={!currentBalance.trim()}>
            <Text>Save balance</Text>
          </Button>
        </View>
      </View>
    )
  }

  if (mode === "edit") {
    const invalid = !!digitsError(accountDigits) || !!digitsError(cardDigits)
    return (
      <View className={cn("gap-3 p-4", !last && "border-b border-border")}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} accessibilityLabel="Name" />
        </Field>
        {kind && (
          <CardFields
            kind={kind}
            bank={bank}
            setBank={setBank}
            accountDigits={accountDigits}
            setAccountDigits={setAccountDigits}
            cardDigits={cardDigits}
            setCardDigits={setCardDigits}
          />
        )}
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" disabled={isUpdating} onPress={resetForm}>
            <Text>Cancel</Text>
          </Button>
          <Button size="sm" className="flex-1" onPress={() => update()} loading={isUpdating} disabled={!name.trim() || invalid}>
            <Text>Save</Text>
          </Button>
        </View>
      </View>
    )
  }

  const balanceNote =
    known && account.balance_as_of
      ? account.balance_source === "alert"
        ? `From your bank, ${formatRelative(account.balance_as_of)}`
        : `Set by you ${formatRelative(account.balance_as_of)}`
      : null

  return (
    <View className={cn("px-4 py-3", !last && "border-b border-border")}>
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-md bg-secondary">
          <Ionicons name={kind ? "card-outline" : "wallet-outline"} size={18} color={kind === "credit" ? colors.primary : colors.foreground} />
        </View>
        <View className={cn("flex-1", account.is_archived && "opacity-50")}>
          <Text className="text-sm font-medium">{account.name}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">{describe(account)}</Text>
          {kind && !account.is_archived && (
            account.last_alert_at ? (
              <View className="mt-1 flex-row items-center gap-1">
                <Ionicons name="checkmark-circle" size={13} color={colors.positive} />
                <Text className="text-xs text-positive">Verified · last bank alert {formatRelative(account.last_alert_at)}</Text>
              </View>
            ) : (
              <Text className="mt-1 text-xs text-muted-foreground">
                Not verified yet. It will be once a{account.institution ? ` ${account.institution}` : ""} alert with these digits is synced.
              </Text>
            )
          )}
        </View>
        <View className="items-end">
          {known ? (
            <Text className={cn("text-sm font-medium", balance.isNegative() && "text-destructive")}>
              {isCreditCard && balance.gt(0) ? "Owes " : ""}{formatCurrency(balance.abs())}
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground">Balance unknown</Text>
          )}
          {!!balanceNote && <Text className="mt-0.5 text-[11px] text-muted-foreground">{balanceNote}</Text>}
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1 pl-12">
        {[
          { label: known ? "Update balance" : "Set balance", onPress: () => setMode("balance"), busy: false },
          ...(kind === "debit" && !account.is_archived
            ? [{
                label: "Import statement",
                onPress: () => router.push({ pathname: "/(modals)/import-statement", params: { accountId: account.id } }),
                busy: false
              }]
            : []),
          { label: "Edit", onPress: () => setMode("edit"), busy: false },
          { label: account.is_archived ? "Unarchive" : "Archive", onPress: () => archive(), busy: isArchiving },
          { label: "Delete", onPress: handleDelete, busy: isDeleting, destructive: true }
        ].map((action) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            disabled={action.busy}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} ${account.name}`}
            hitSlop={6}
            className="web:cursor-pointer"
          >
            <Text className={cn("text-xs font-medium", action.destructive ? "text-destructive" : "text-muted-foreground", action.busy && "opacity-50")}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export default function AccountsScreen() {
  const { data: accounts, isLoading, error, refetch } = useAccounts(true)
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const [kind, setKind] = useState<CardKind>("debit")
  const [bank, setBank] = useState("")
  const [accountDigits, setAccountDigits] = useState("")
  const [cardDigits, setCardDigits] = useState("")
  const [name, setName] = useState("")
  // Remounts the form after a successful add so the bank picker's "Other" state resets too.
  const [formKey, setFormKey] = useState(0)

  const digits = kind === "credit" ? cardDigits.trim() : accountDigits.trim() || cardDigits.trim()
  const defaultName = bank.trim()
    ? `${bank.trim()} ${kind === "credit" ? "Credit" : "Debit"} card${digits ? ` ${maskedDigits(digits)}` : ""}`
    : ""
  const invalid = !!digitsError(accountDigits) || !!digitsError(cardDigits)
  const canSubmit = !!bank.trim() && !!digits && !invalid

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () =>
      accountsApi.create({
        name: name.trim() || defaultName,
        type: KIND_TO_TYPE[kind],
        institution: bank.trim(),
        ...digitsPayload(kind, accountDigits, cardDigits)
      }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setBank("")
      setAccountDigits("")
      setCardDigits("")
      setName("")
      setFormKey((k) => k + 1)
    },
    onError: (error: any) => showAlert("Couldn't add card", errorDetail(error, "Failed to add card"))
  })

  return (
    <ModalScreen title="Cards">
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load cards" onRetry={refetch} />
      ) : (
        <>
          <View>
            <SectionTitle title="Your cards" />
            {!accounts || accounts.length === 0 ? (
              <Card>
                <EmptyState
                  icon="card-outline"
                  title="No cards yet"
                  subtitle="Add your debit and credit cards. Synced bank alerts are matched to them by their last 4 digits."
                />
              </Card>
            ) : (
              <Card>
                {accounts.map((account, i) => <AccountRow key={account.id} account={account} last={i === accounts.length - 1} />)}
              </Card>
            )}
          </View>

          <View>
            <SectionTitle title="Add a card" />
            <Card key={formKey} className="gap-4 p-4">
              <Segmented
                options={[
                  { value: "debit", label: "Debit card" },
                  { value: "credit", label: "Credit card" }
                ]}
                value={kind}
                onChange={setKind}
              />
              <CardFields
                kind={kind}
                bank={bank}
                setBank={setBank}
                accountDigits={accountDigits}
                setAccountDigits={setAccountDigits}
                cardDigits={cardDigits}
                setCardDigits={setCardDigits}
              />
              <Field label="Name" hint="Optional">
                <Input value={name} onChangeText={setName} placeholder={defaultName || "e.g. HDFC Debit card"} accessibilityLabel="Name" />
              </Field>
              <Text className="text-xs text-muted-foreground">
                No opening balance needed. The balance comes from your bank&apos;s next alert, or you can set it any time.
              </Text>
              <Button onPress={() => create()} loading={isCreating} disabled={!canSubmit}>
                <Text>Add card</Text>
              </Button>
            </Card>
          </View>
        </>
      )}
    </ModalScreen>
  )
}
