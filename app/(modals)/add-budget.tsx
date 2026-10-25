import { View, ActivityIndicator } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo, useEffect } from "react"
import { budgetApi } from "@/api/endpoints/budgets"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { useCategories } from "@/hooks/useCategories"
import { TransactionCategory } from "@/types/domain"
import { parseMoneyInput } from "@/utils/money"
import { useTheme } from "@/lib/theme"
import { ModalScreen, InfoRow } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field, Segmented } from "@/components/ui/misc"

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function AddBudgetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const budgetId = id ? Number(id) : undefined
  const isEditMode = !!id
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const { data: categories } = useCategories()

  const { data: budgets } = useQuery({
    queryKey: ["budgets"],
    queryFn: ({ signal }) => budgetApi.list(signal),
    enabled: isEditMode
  })

  const existing = useMemo(() => budgets?.find(b => b.id === budgetId), [budgets, budgetId])

  const [category, setCategory] = useState<TransactionCategory>("food")
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly")
  const [limitAmount, setLimitAmount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (existing) {
      // Populating edit-mode fields once the existing budget finishes loading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategory(existing.category)
      setPeriod(existing.period)
      setLimitAmount(String(existing.limit_amount))
    }
  }, [existing])

  const handleSubmit = async () => {
    const amount = parseMoneyInput(limitAmount)
    if (amount === null || amount <= 0) {
      showAlert("Error", "Please enter a valid limit amount (up to 2 decimal places)")
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditMode && budgetId) {
        await budgetApi.updateLimit(budgetId, amount)
      } else {
        await budgetApi.create({ category, limit_amount: amount, period })
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      router.back()
    } catch (error: any) {
      if (error.response?.status === 409) {
        showAlert("Budget already exists", extractErrorMessage(error, "This category already has a budget for the current period."))
      } else {
        showAlert("Error", extractErrorMessage(error, `Failed to ${isEditMode ? "update" : "create"} budget`))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditMode && !existing) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    )
  }

  return (
    <ModalScreen
      title={isEditMode ? "Edit budget" : "New budget"}
      closeDisabled={isSubmitting}
      footer={
        <Button onPress={handleSubmit} loading={isSubmitting}>
          <Text>{isEditMode ? "Save changes" : "Create budget"}</Text>
        </Button>
      }
    >
      {isEditMode ? (
        <Card>
          <InfoRow label="Category" value={capitalize(category)} />
          <InfoRow label="Period" value={capitalize(period)} last />
        </Card>
      ) : (
        <>
          <Field label="Category">
            <ChipGroup
              options={categories?.map(c => ({ value: c.name, label: capitalize(c.name) })) ?? []}
              value={category}
              onChange={setCategory}
            />
          </Field>
          <Field label="Period">
            <Segmented
              options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
              value={period}
              onChange={setPeriod}
            />
          </Field>
        </>
      )}

      <Field label="Limit">
        <Input
          accessibilityLabel="Limit amount"
          placeholder="0.00"
          value={limitAmount}
          onChangeText={setLimitAmount}
          keyboardType="decimal-pad"
          leading={<Text className="text-sm text-muted-foreground">₹</Text>}
        />
      </Field>
    </ModalScreen>
  )
}
