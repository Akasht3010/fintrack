import { View, ActivityIndicator } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect, useRef } from "react"
import { useUserStore } from "@/store/useUserStore"
import { useCreateTransaction } from "@/hooks/useCreateTransaction"
import { useCategories } from "@/hooks/useCategories"
import { useAccounts } from "@/hooks/useAccounts"
import { transactionApi } from "@/api/endpoints/transactions"
import { budgetApi } from "@/api/endpoints/budgets"
import { extractErrorMessage } from "@/api/client"
import { invalidateTransactionQueries } from "@/api/invalidate"
import { Budget, PaymentMethod } from "@/types/domain"
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/paymentMethods"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"
import { generateIdempotencyKey } from "@/utils/idempotencyKey"
import { parseMoneyInput } from "@/utils/money"
import { showAlert } from "@/utils/alert"
import { useTheme } from "@/lib/theme"
import { ModalScreen } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field, Segmented } from "@/components/ui/misc"

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const transactionId = id ? Number(id) : undefined
  const isEditMode = !!id
  const { user } = useUserStore()
  const { colors } = useTheme()
  const { mutate: createTransaction, isPending: isCreating } = useCreateTransaction()
  const [transactionType, setTransactionType] = useState<"debit" | "credit">("debit")
  // Credit gets every category (same expense list plus the income-only
  // ones) — a credit isn't always pure income (e.g. a refund logically
  // belongs under the same category the original expense used).
  const { data: categories } = useCategories(transactionType === "credit" ? undefined : "expense")
  const { data: accounts } = useAccounts()
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  // Generated once per screen visit (not per submit) so a retried create —
  // not a deliberate resubmission after an error, but a network-level retry
  // of the same attempt — reuses the same key and gets deduped server-side.
  const idempotencyKeyRef = useRef(generateIdempotencyKey())

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: ["transaction", id],
    queryFn: ({ signal }) => transactionApi.getById(transactionId!, signal),
    enabled: isEditMode
  })

  const [amount, setAmount] = useState("")
  const [merchant, setMerchant] = useState("")
  const [description, setDescription] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("food")
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined)

  // The category list is scoped to the current type (expense vs income), so
  // switching the toggle can leave selectedCategory pointing at a name from
  // the other list — fall back to the first category the new list actually has.
  useEffect(() => {
    if (categories?.length && !categories.some(c => c.name === selectedCategory)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCategory(categories[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  useEffect(() => {
    if (existing) {
      // Populating edit-mode fields once the existing transaction finishes loading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(String(existing.amount))
      setMerchant(existing.merchant)
      setDescription(existing.description === existing.merchant ? "" : existing.description)
      setSelectedCategory(existing.category)
      setTransactionType(existing.type)
      setSelectedAccountId(existing.account_id ?? undefined)
      setPaymentMethod(existing.payment_method ?? undefined)
    }
  }, [existing])

  const isPending = isCreating || isSaving
  const isCredit = transactionType === "credit"
  const submitLabel = isEditMode ? "Save changes" : isCredit ? "Add income" : "Add expense"

  const handleSubmit = async () => {
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      showAlert("Error", "Please enter a valid amount (up to 2 decimal places)")
      return
    }

    if (!merchant.trim()) {
      showAlert("Error", "Please enter merchant name")
      return
    }

    if (isEditMode) {
      setIsSaving(true)
      try {
        await transactionApi.update(transactionId!, {
          amount: parsedAmount,
          type: transactionType,
          category: selectedCategory,
          merchant,
          description: description || merchant,
          account_id: selectedAccountId ?? null,
          payment_method: paymentMethod ?? null
        })
        invalidateTransactionQueries(queryClient)
        router.back()
      } catch (error: any) {
        showAlert("Error", extractErrorMessage(error, "Failed to update transaction"))
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (!user?.id) {
      showAlert("Error", "User not found")
      return
    }

    let budgetsBefore: Budget[] = []
    if (transactionType === "debit") {
      try {
        budgetsBefore = await budgetApi.list()
      } catch {
        // Alerting is best-effort — don't block adding the expense over this
      }
    }

    createTransaction({
      amount: parsedAmount,
      type: transactionType,
      category: selectedCategory,
      merchant,
      description: description || merchant,
      date: new Date().toISOString(),
      source: "manual",
      is_recurring: false,
      account_id: selectedAccountId ?? null,
      payment_method: paymentMethod ?? null,
      idempotency_key: idempotencyKeyRef.current
    }, {
      // Cache invalidation is handled by useCreateTransaction itself.
      onSuccess: async () => {
        if (transactionType === "debit") {
          try {
            const budgetsAfter = await budgetApi.list()
            await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
          } catch {
            // Same — never let alerting get in the way of the actual save
          }
        }
        router.back()
      },
      onError: (error: any) => {
        // The only 409 the create endpoint returns is the idempotency key
        // already being used — i.e. an earlier attempt of this same
        // submission (whose response we never got, e.g. a timeout) did
        // save. Treat it as the success it is rather than inviting the user
        // to add the expense a second time by hand.
        if (error?.response?.status === 409) {
          invalidateTransactionQueries(queryClient)
          router.back()
          return
        }
        if (__DEV__) {
          console.log("Add transaction failed:", error?.response?.status, error?.response?.data, error?.message)
        }
        showAlert("Error", extractErrorMessage(error, `Failed to add ${isCredit ? "income" : "expense"}`))
      }
    })
  }

  if (isEditMode && isLoadingExisting) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    )
  }

  return (
    <ModalScreen
      title={isEditMode ? "Edit transaction" : "New transaction"}
      closeDisabled={isPending}
      footer={
        <Button onPress={handleSubmit} loading={isPending}>
          <Text>{submitLabel}</Text>
        </Button>
      }
    >
      <Segmented
        options={[{ value: "debit", label: "Expense" }, { value: "credit", label: "Income" }]}
        value={transactionType}
        onChange={setTransactionType}
      />

      <Field label="Amount">
        <Input
          accessibilityLabel="Amount"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          leading={<Text className="text-sm text-muted-foreground">₹</Text>}
        />
      </Field>

      <Field label={isCredit ? "Source" : "Merchant"}>
        <Input
          accessibilityLabel={isCredit ? "Source" : "Merchant"}
          placeholder={isCredit ? "e.g. Salary, Freelance" : "e.g. Swiggy, Uber"}
          value={merchant}
          maxLength={120}
          onChangeText={setMerchant}
        />
      </Field>

      <Field label={isCredit ? "Received as" : "Category"}>
        <ChipGroup
          options={categories?.map(c => ({ value: c.name, label: capitalize(c.name) })) ?? []}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </Field>

      {!!accounts?.length && (
        <Field label="Account" hint="Optional">
          <ChipGroup
            options={[{ value: 0, label: "None" }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
            value={selectedAccountId ?? 0}
            onChange={(v) => setSelectedAccountId(v === 0 ? undefined : v)}
          />
        </Field>
      )}

      <Field label="Paid via" hint="Optional">
        <ChipGroup
          options={[{ value: "", label: "—" }, ...PAYMENT_METHODS.map(m => ({ value: m, label: paymentMethodLabel(m) }))]}
          value={paymentMethod ?? ""}
          onChange={(v) => setPaymentMethod(v === "" ? undefined : (v as PaymentMethod))}
        />
      </Field>

      <Field label="Note" hint="Optional">
        <Input
          accessibilityLabel="Note"
          placeholder="Add a note"
          value={description}
          maxLength={500}
          onChangeText={setDescription}
          multiline
        />
      </Field>
    </ModalScreen>
  )
}
