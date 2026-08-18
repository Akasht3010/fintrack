import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { accountsApi } from "@/api/endpoints/accounts"
import { useAccounts } from "@/hooks/useAccounts"
import { formatCurrency } from "@/utils/currency"
import { CURRENCIES } from "@/constants/currencies"
import { Account, AccountType } from "@/types/domain"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { confirm } from "@/utils/confirm"

const ACCOUNT_TYPES: AccountType[] = ["bank", "cash", "credit_card", "wallet", "investment"]

const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  bank: "🏦",
  cash: "💵",
  credit_card: "💳",
  wallet: "👛",
  investment: "📈"
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Bank",
  cash: "Cash",
  credit_card: "Credit Card",
  wallet: "Wallet",
  investment: "Investment"
}

function errorDetail(error: any, fallback: string): string {
  return error?.response?.data?.detail || fallback
}

function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["accounts"] })
  queryClient.invalidateQueries({ queryKey: ["net-worth"] })
}

function AccountRow({ account }: { account: Account }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [openingBalance, setOpeningBalance] = useState(String(account.opening_balance))

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: () => accountsApi.update(account.id, {
      name: name.trim(),
      opening_balance: parseFloat(openingBalance) || 0
    }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setIsEditing(false)
    },
    onError: (error: any) => Alert.alert("Couldn't save", errorDetail(error, "Failed to update account"))
  })

  const { mutate: archive, isPending: isArchiving } = useMutation({
    mutationFn: () => accountsApi.update(account.id, { is_archived: !account.is_archived }),
    onSuccess: () => invalidateAccountQueries(queryClient),
    onError: (error: any) => Alert.alert("Error", errorDetail(error, "Failed to update account"))
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => accountsApi.remove(account.id),
    onSuccess: () => invalidateAccountQueries(queryClient),
    onError: (error: any) => Alert.alert("Couldn't delete", errorDetail(error, "Failed to delete account"))
  })

  const handleDelete = async () => {
    const confirmed = await confirm("Delete account", `Delete "${account.name}"? This can't be undone.`, {
      confirmLabel: "Delete",
      destructive: true
    })
    if (confirmed) remove()
  }

  const isCreditCard = account.type === "credit_card"
  const isNegative = account.balance < 0

  if (isEditing) {
    return (
      <View className="px-4 py-3 border-b border-border dark:border-white/10 gap-2">
        <TextInput
          value={name}
          onChangeText={setName}
          className="border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
          placeholderTextColor="#9ca3af"
        />
        <View className="flex-row items-center border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3">
          <Text className="text-sm text-muted dark:text-neutral-400 mr-2">Opening balance</Text>
          <TextInput
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
            className="flex-1 py-2 text-sm text-neutral-900 dark:text-white text-right"
          />
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => update()}
            disabled={isUpdating || !name.trim()}
            className="flex-1 items-center py-2 rounded-xl bg-primary-600 dark:bg-accent-600"
          >
            {isUpdating ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text className="text-sm font-semibold text-white">Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setName(account.name)
              setOpeningBalance(String(account.opening_balance))
              setIsEditing(false)
            }}
            disabled={isUpdating}
            className="flex-1 items-center py-2 rounded-xl border border-border dark:border-white/15"
          >
            <Text className="text-sm font-semibold text-neutral-900 dark:text-white">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="px-4 py-3 border-b border-border dark:border-white/10">
      <View className="flex-row items-center justify-between">
        <TouchableOpacity onPress={() => setIsEditing(true)} className="flex-row items-center gap-3 flex-1">
          <Text className="text-lg">{ACCOUNT_TYPE_ICONS[account.type]}</Text>
          <View>
            <Text className={`text-sm font-medium text-neutral-900 dark:text-white ${account.is_archived ? "opacity-50" : ""}`}>
              {account.name}
            </Text>
            <Text className="text-xs text-muted dark:text-neutral-400 mt-0.5">
              {ACCOUNT_TYPE_LABELS[account.type]}{account.is_archived ? " · Archived" : ""}
            </Text>
          </View>
        </TouchableOpacity>
        <Text className={`text-sm font-bold ${
          isCreditCard || isNegative ? "text-red-600 dark:text-red-400" : "text-neutral-900 dark:text-white"
        }`}>
          {isCreditCard && account.balance > 0 ? "Owes " : ""}{formatCurrency(Math.abs(account.balance), account.currency)}
        </Text>
      </View>
      <View className="flex-row justify-end gap-4 mt-2">
        <TouchableOpacity onPress={() => archive()} disabled={isArchiving}>
          <Text className="text-xs font-medium text-primary-600 dark:text-accent-400">
            {isArchiving ? "..." : account.is_archived ? "Unarchive" : "Archive"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} disabled={isDeleting}>
          {isDeleting ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Text className="text-xs font-medium text-red-600 dark:text-red-400">Delete</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function AccountsScreen() {
  const { data: accounts, isLoading, error, refetch } = useAccounts(true)
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<AccountType>("bank")
  const [newCurrency, setNewCurrency] = useState("INR")
  const [newOpeningBalance, setNewOpeningBalance] = useState("")

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => accountsApi.create({
      name: newName.trim(),
      type: newType,
      currency: newCurrency,
      opening_balance: parseFloat(newOpeningBalance) || 0
    }),
    onSuccess: () => {
      invalidateAccountQueries(queryClient)
      setNewName("")
      setNewCurrency("INR")
      setNewOpeningBalance("")
    },
    onError: (error: any) => Alert.alert("Couldn't add account", errorDetail(error, "Failed to create account"))
  })

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Accounts</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load accounts" onRetry={refetch} />
      ) : (
        <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Add an account</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setNewType(type)}
                  className={`px-3 py-2 rounded-full ${
                    newType === type ? "bg-primary-600 dark:bg-accent-600" : "bg-neutral-100 dark:bg-white/10"
                  }`}
                >
                  <Text className={`text-xs font-medium ${
                    newType === type ? "text-white" : "text-neutral-700 dark:text-neutral-300"
                  }`}>
                    {ACCOUNT_TYPE_ICONS[type]} {ACCOUNT_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g., HDFC Savings"
              className="border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-3 text-sm text-neutral-900 dark:text-white mb-2"
              placeholderTextColor="#9ca3af"
            />
            <View className="flex-row flex-wrap gap-2 mb-2">
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => setNewCurrency(c.code)}
                  className={`px-3 py-2 rounded-full ${
                    newCurrency === c.code ? "bg-primary-600 dark:bg-accent-600" : "bg-neutral-100 dark:bg-white/10"
                  }`}
                >
                  <Text className={`text-xs font-medium ${
                    newCurrency === c.code ? "text-white" : "text-neutral-700 dark:text-neutral-300"
                  }`}>
                    {c.symbol} {c.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row items-center border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 mb-2">
              <Text className="text-sm text-muted dark:text-neutral-400 mr-2">
                {newType === "credit_card" ? "Amount currently owed" : "Opening balance"}
              </Text>
              <TextInput
                value={newOpeningBalance}
                onChangeText={setNewOpeningBalance}
                placeholder="0"
                keyboardType="decimal-pad"
                className="flex-1 py-3 text-sm text-neutral-900 dark:text-white text-right"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <TouchableOpacity
              onPress={() => create()}
              disabled={isCreating || !newName.trim()}
              className={`items-center justify-center py-3 rounded-xl ${
                isCreating || !newName.trim() ? "bg-neutral-200 dark:bg-neutral-800" : "bg-primary-600 dark:bg-accent-600"
              }`}
            >
              {isCreating ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text className="text-sm font-semibold text-white">Add Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mb-8">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Your accounts</Text>
            {!accounts || accounts.length === 0 ? (
              <EmptyState
                icon="🏦"
                title="No accounts yet"
                subtitle="Add one above to start tracking your net worth."
              />
            ) : (
              <GlassCard>
                {accounts.map(account => <AccountRow key={account.id} account={account} />)}
              </GlassCard>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
