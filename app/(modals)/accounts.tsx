import { useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { accountsApi } from "@/api/endpoints/accounts"
import { useAccounts } from "@/hooks/useAccounts"
import { formatCurrency } from "@/utils/currency"
import { parseMoneyInput, toDecimal } from "@/utils/money"
import { Account, AccountType } from "@/types/domain"
import { confirm } from "@/utils/confirm"
import { extractErrorMessage as errorDetail } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { ModalScreen, SectionTitle } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field } from "@/components/ui/misc"
import { maskedDigits } from "@/lib/paymentMethods"
import { formatRelative } from "@/utils/date"

const ACCOUNT_TYPES: AccountType[] = ["bank", "cash", "credit_card", "wallet", "investment"]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  credit_card: "Credit card",
  wallet: "Wallet",
  investment: "Investment"
}

// Bank alerts print only the last 3–4 digits ("A/c XX1234", "Card ending 9876").
const DIGITS_RE = /^\d{3,4}$/

function digitsError(value: string): string | false {
  return value.trim() && !DIGITS_RE.test(value.trim()) ? "Enter the last 3 or 4 digits" : false
}

function digitLabels(type: AccountType) {
  return type === "credit_card"
    ? { primary: "Card number — last 4 digits", secondary: null }
    : type === "bank"
      ? { primary: "Account number — last 4 digits", secondary: "Debit card — last 4 digits (optional)" }
      : { primary: null, secondary: null }
}

/** Last-4 inputs shared by the add and edit forms. */
function MatchFields({
  type, institution, setInstitution, last4, setLast4, cardLast4, setCardLast4
}: {
  type: AccountType
  institution: string
  setInstitution: (v: string) => void
  last4: string
  setLast4: (v: string) => void
  cardLast4: string
  setCardLast4: (v: string) => void
}) {
  const labels = digitLabels(type)
  if (!labels.primary) return null
  return (
    <>
      <Field label={type === "credit_card" ? "Issuer" : "Bank"}>
        <Input value={institution} onChangeText={setInstitution} placeholder="e.g. HDFC" accessibilityLabel="Bank name" />
      </Field>
      <Field
        label={labels.primary}
        error={digitsError(last4)}
        hint="As printed in bank alerts (A/c XX1234) — imported transactions are matched to this account by it."
      >
        <Input value={last4} onChangeText={setLast4} invalid={!!digitsError(last4)} placeholder="1234" keyboardType="number-pad" maxLength={4} accessibilityLabel={labels.primary} />
      </Field>
      {labels.secondary && (
        <Field label={labels.secondary} error={digitsError(cardLast4)}>
          <Input value={cardLast4} onChangeText={setCardLast4} invalid={!!digitsError(cardLast4)} placeholder="9876" keyboardType="number-pad" maxLength={4} accessibilityLabel={labels.secondary} />
        </Field>
      )}
    </>
  )
}

function accountSubtitle(account: Account): string {
  const parts = [ACCOUNT_TYPE_LABELS[account.type]]
  const id = [account.institution, maskedDigits(account.last4)].filter(Boolean).join(" ")
  if (id) parts.push(id)
  if (account.card_last4) parts.push(`card ${maskedDigits(account.card_last4)}`)
  if (account.is_archived) parts.push("Archived")
  return parts.join(" · ")
}

function balanceNote(account: Account): string | null {
  if (!account.balance_as_of) return null
  const when = formatRelative(account.balance_as_of)
  return account.balance_source === "alert" ? `From your bank's last alert, ${when}` : `Set by you ${when}`
}

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["net-worth"] })
}

function AccountRow({ account, last }: { account: Account; last: boolean }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"view" | "edit" | "balance">("view")
  const [name, setName] = useState(account.name)
  const [openingBalance, setOpeningBalance] = useState(String(account.opening_balance))
  const [institution, setInstitution] = useState(account.institution ?? "")
  const [last4, setLast4] = useState(account.last4 ?? "")
  const [cardLast4, setCardLast4] = useState(account.card_last4 ?? "")
  const [currentBalance, setCurrentBalance] = useState("")

  const resetForm = () => {
    setName(account.name)
    setOpeningBalance(String(account.opening_balance))
    setInstitution(account.institution ?? "")
    setLast4(account.last4 ?? "")
    setCardLast4(account.card_last4 ?? "")
    setCurrentBalance("")
    setMode("view")
  }

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (opening_balance: number) =>
      accountsApi.update(account.id, {
        name: name.trim(),
        opening_balance,
        institution: institution.trim() || null,
        last4: last4.trim() || null,
        card_last4: account.type === "bank" ? cardLast4.trim() || null : null
      }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      setMode("view")
    },
    onError: (error: any) => showAlert("Couldn't save", errorDetail(error, "Failed to update account"))
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
    onError: (error: any) => showAlert("Error", errorDetail(error, "Failed to update account"))
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => accountsApi.remove(account.id),
    onSuccess: () => invalidateAccountQueries(queryClient),
    onError: (error: any) => showAlert("Couldn't delete", errorDetail(error, "Failed to delete account"))
  })

  // Editing an existing balance: an empty or malformed field is a mistake,
  // never "set it to ₹0" — reject it instead of overwriting the real value.
  const handleSave = () => {
    const parsed = parseMoneyInput(openingBalance)
    if (parsed === null) {
      showAlert("Error", "Please enter a valid opening balance")
      return
    }
    if (digitsError(last4) || digitsError(cardLast4)) return
    update(parsed)
  }

  const handleSetBalance = () => {
    const parsed = parseMoneyInput(currentBalance)
    if (parsed === null) {
      showAlert("Error", "Please enter the balance as a number")
      return
    }
    setBalance(parsed)
  }

  const handleDelete = async () => {
    const confirmed = await confirm("Delete account", `Delete "${account.name}"? This can't be undone.`, {
      confirmLabel: "Delete",
      destructive: true
    })
    if (confirmed) remove()
  }

  const isCreditCard = account.type === "credit_card"
  const balance = toDecimal(account.balance)

  if (mode === "balance") {
    return (
      <View className={cn("gap-3 p-4", !last && "border-b border-border")}>
        <Field
          label={isCreditCard ? `Amount owed on ${account.name}` : `Current balance of ${account.name}`}
          hint={isCreditCard ? "As shown in your card app or statement." : "As shown by your bank app, or 'Check balance' in Google Pay / your UPI app."}
        >
          <Input
            value={currentBalance}
            onChangeText={setCurrentBalance}
            keyboardType="decimal-pad"
            autoFocus
            placeholder={balance.toFixed(2)}
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
    return (
      <View className={cn("gap-3 p-4", !last && "border-b border-border")}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} accessibilityLabel="Account name" />
        </Field>
        <MatchFields
          type={account.type}
          institution={institution}
          setInstitution={setInstitution}
          last4={last4}
          setLast4={setLast4}
          cardLast4={cardLast4}
          setCardLast4={setCardLast4}
        />
        <Field label={isCreditCard ? "Amount owed when you started tracking" : "Opening balance"}>
          <Input
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
            accessibilityLabel="Opening balance"
            leading={<Text className="text-sm text-muted-foreground">₹</Text>}
          />
        </Field>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={isUpdating}
            onPress={resetForm}
          >
            <Text>Cancel</Text>
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onPress={handleSave}
            loading={isUpdating}
            disabled={!name.trim() || !!digitsError(last4) || !!digitsError(cardLast4)}
          >
            <Text>Save</Text>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className={cn("px-4 py-3", !last && "border-b border-border")}>
      <View className="flex-row items-center gap-3">
        <View className={cn("flex-1", account.is_archived && "opacity-50")}>
          <Text className="text-sm font-medium">{account.name}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">{accountSubtitle(account)}</Text>
        </View>
        <View className="items-end">
          <Text className={cn("text-sm font-medium", balance.isNegative() && "text-destructive")}>
            {isCreditCard && balance.gt(0) ? "Owes " : ""}{formatCurrency(balance.abs())}
          </Text>
          {!!balanceNote(account) && <Text className="mt-0.5 text-[11px] text-muted-foreground">{balanceNote(account)}</Text>}
        </View>
      </View>
      {!account.last4 && digitLabels(account.type).primary && !account.is_archived && (
        <Text className="mt-2 text-xs text-muted-foreground">
          Add the last 4 digits so imported transactions are matched to this account.
        </Text>
      )}
      <View className="mt-2 flex-row gap-4">
        {[
          { label: "Update balance", onPress: () => setMode("balance"), busy: false },
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
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<AccountType>("bank")
  const [newOpeningBalance, setNewOpeningBalance] = useState("")
  const [newInstitution, setNewInstitution] = useState("")
  const [newLast4, setNewLast4] = useState("")
  const [newCardLast4, setNewCardLast4] = useState("")

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (opening_balance: number) => {
      const matchable = !!digitLabels(newType).primary
      return accountsApi.create({
        name: newName.trim(),
        type: newType,
        opening_balance,
        institution: matchable ? newInstitution.trim() || null : null,
        last4: matchable ? newLast4.trim() || null : null,
        card_last4: newType === "bank" ? newCardLast4.trim() || null : null
      })
    },
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      // Creating an account with digits claims matching past imports.
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["insights"] })
      setNewName("")
      setNewOpeningBalance("")
      setNewInstitution("")
      setNewLast4("")
      setNewCardLast4("")
    },
    onError: (error: any) => showAlert("Couldn't add account", errorDetail(error, "Failed to create account"))
  })

  // New account: a blank balance legitimately means "starts at ₹0", but
  // anything typed must parse cleanly.
  const handleCreate = () => {
    const parsed = newOpeningBalance.trim() ? parseMoneyInput(newOpeningBalance) : 0
    if (parsed === null) {
      showAlert("Error", "Please enter a valid opening balance")
      return
    }
    if (digitsError(newLast4) || digitsError(newCardLast4)) return
    create(parsed)
  }

  return (
    <ModalScreen title="Accounts">
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load accounts" onRetry={refetch} />
      ) : (
        <>
          <View>
            <SectionTitle title="Your accounts" />
            {!accounts || accounts.length === 0 ? (
              <Card>
                <EmptyState
                  icon="card-outline"
                  title="No accounts yet"
                  subtitle="Add your bank accounts and cards below — imported transactions are matched to them by their last 4 digits."
                />
              </Card>
            ) : (
              <Card>
                {accounts.map((account, i) => <AccountRow key={account.id} account={account} last={i === accounts.length - 1} />)}
              </Card>
            )}
          </View>

          <View>
            <SectionTitle title="Add an account" />
            <Card className="gap-4 p-4">
              <Field label="Type">
                <ChipGroup options={ACCOUNT_TYPES.map(t => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))} value={newType} onChange={setNewType} />
              </Field>
              <Field label="Name">
                <Input value={newName} onChangeText={setNewName} placeholder="e.g. HDFC Savings" accessibilityLabel="Account name" />
              </Field>
              <MatchFields
                type={newType}
                institution={newInstitution}
                setInstitution={setNewInstitution}
                last4={newLast4}
                setLast4={setNewLast4}
                cardLast4={newCardLast4}
                setCardLast4={setNewCardLast4}
              />
              <Field label={newType === "credit_card" ? "Amount currently owed" : "Opening balance"}>
                <Input
                  value={newOpeningBalance}
                  onChangeText={setNewOpeningBalance}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  accessibilityLabel={newType === "credit_card" ? "Amount currently owed" : "Opening balance"}
                  leading={<Text className="text-sm text-muted-foreground">₹</Text>}
                />
              </Field>
              <Button
                onPress={handleCreate}
                loading={isCreating}
                disabled={!newName.trim() || !!digitsError(newLast4) || !!digitsError(newCardLast4)}
              >
                <Text>Add account</Text>
              </Button>
            </Card>
          </View>
        </>
      )}
    </ModalScreen>
  )
}
