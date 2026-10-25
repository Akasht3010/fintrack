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

const ACCOUNT_TYPES: AccountType[] = ["bank", "cash", "credit_card", "wallet", "investment"]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  credit_card: "Credit card",
  wallet: "Wallet",
  investment: "Investment"
}

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["net-worth"] })
}

function AccountRow({ account, last }: { account: Account; last: boolean }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [openingBalance, setOpeningBalance] = useState(String(account.opening_balance))

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (opening_balance: number) => accountsApi.update(account.id, { name: name.trim(), opening_balance }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setIsEditing(false)
    },
    onError: (error: any) => showAlert("Couldn't save", errorDetail(error, "Failed to update account"))
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
    update(parsed)
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

  if (isEditing) {
    return (
      <View className={cn("gap-3 p-4", !last && "border-b border-border")}>
        <Field label="Name">
          <Input value={name} onChangeText={setName} accessibilityLabel="Account name" />
        </Field>
        <Field label="Opening balance">
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
            onPress={() => {
              setName(account.name)
              setOpeningBalance(String(account.opening_balance))
              setIsEditing(false)
            }}
          >
            <Text>Cancel</Text>
          </Button>
          <Button size="sm" className="flex-1" onPress={handleSave} loading={isUpdating} disabled={!name.trim()}>
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
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.type]}{account.is_archived ? " · Archived" : ""}
          </Text>
        </View>
        <Text className={cn("text-sm font-medium", balance.isNegative() && "text-destructive")}>
          {isCreditCard && balance.gt(0) ? "Owes " : ""}{formatCurrency(balance.abs())}
        </Text>
      </View>
      <View className="mt-2 flex-row gap-4">
        {[
          { label: "Edit", onPress: () => setIsEditing(true), busy: false },
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

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (opening_balance: number) => accountsApi.create({ name: newName.trim(), type: newType, opening_balance }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setNewName("")
      setNewOpeningBalance("")
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
                <EmptyState icon="card-outline" title="No accounts yet" subtitle="Add one below to start tracking your net worth." />
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
              <Button onPress={handleCreate} loading={isCreating} disabled={!newName.trim()}>
                <Text>Add account</Text>
              </Button>
            </Card>
          </View>
        </>
      )}
    </ModalScreen>
  )
}
