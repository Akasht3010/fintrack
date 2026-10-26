import { View, ActivityIndicator } from "react-native"
import { router, useFocusEffect } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { insightsApi } from "@/api/endpoints/insights"
import { recurringApi } from "@/api/endpoints/recurring"
import { formatCurrency } from "@/utils/currency"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { categoryStyle } from "@/lib/categories"
import { PAYMENT_METHODS, paymentMethodIcon, paymentMethodLabel } from "@/lib/paymentMethods"
import { useAccounts } from "@/hooks/useAccounts"
import { InsightsFilters, PaymentMethod } from "@/types/domain"
import { Ionicons } from "@expo/vector-icons"
import { ChipGroup } from "@/components/ui/misc"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { Page, PageHeader, LinkRow } from "@/components/layout"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Text } from "@/components/ui/text"

// Bar heights are computed in pixels against this fixed track rather than
// as `%` strings: a percentage height only resolves against an ancestor
// with an explicit pixel height, which web flexbox doesn't reliably see
// through nested flex-1 containers (bars rendered at 0 height in browsers).
const BAR_TRACK_HEIGHT = 120

export default function InsightsScreen() {
  const { colors } = useTheme()
  const isDesktop = useIsDesktop()

  const [filters, setFilters] = useState<InsightsFilters>({})
  const isFiltered = filters.accountId !== undefined || filters.paymentMethod !== undefined
  const { data: accounts } = useAccounts()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["insights", filters],
    queryFn: ({ signal }) => insightsApi.summary(6, signal, filters),
    placeholderData: (previous) => previous
  })

  const { data: recurring, refetch: refetchRecurring } = useQuery({
    queryKey: ["recurring"],
    queryFn: ({ signal }) => recurringApi.summary(signal)
  })

  useFocusEffect(
    useCallback(() => {
      refetch()
      refetchRecurring()
    }, [refetch, refetchRecurring])
  )

  const hasAnySpend =
    !!data &&
    (data.monthly_totals.some(m => m.total > 0) ||
      data.monthly_income_totals.some(m => m.total > 0) ||
      data.category_breakdown.length > 0 ||
      data.top_merchants.length > 0)

  const maxMonthly = data
    ? Math.max(1, ...data.monthly_totals.map(m => m.total), ...data.monthly_income_totals.map(m => m.total))
    : 1
  const categoryTotal = data ? data.category_breakdown.reduce((sum, c) => sum + c.total, 0) : 0

  const expense = data?.monthly_totals.at(-1)?.total ?? 0
  const income = data?.monthly_income_totals.at(-1)?.total ?? 0
  const savings = income - expense
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : null

  const summary = (
    <Card className="flex-row">
      {[
        { label: "Income", value: formatCurrency(income), tone: "text-positive" },
        { label: "Spent", value: formatCurrency(expense), tone: "text-negative" },
        { label: "Saved", value: savingsRate === null ? "—" : `${savingsRate}%`, tone: savingsRate !== null && savingsRate < 0 ? "text-negative" : "" }
      ].map((s, i) => (
        <View key={s.label} className={cn("flex-1 p-4", i > 0 && "border-l border-border")}>
          <Text className="text-[13px] text-muted-foreground">{s.label}</Text>
          <Text numberOfLines={1} className={cn("mt-1 text-lg font-semibold", s.tone)}>
            {s.value}
          </Text>
        </View>
      ))}
    </Card>
  )

  const trend = data && (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-4">
        <View>
          <CardTitle>Monthly trend</CardTitle>
          <CardDescription>Last {data.monthly_totals.length} months</CardDescription>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-sm bg-positive" />
            <Text className="text-xs text-muted-foreground">Income</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-sm bg-primary" />
            <Text className="text-xs text-muted-foreground">Spent</Text>
          </View>
        </View>
      </CardHeader>
      <View className="flex-row items-end justify-between px-4 pb-4">
        {data.monthly_totals.map((m, i) => {
          const inc = data.monthly_income_totals[i]?.total ?? 0
          const expenseHeight = Math.max(2, (m.total / maxMonthly) * BAR_TRACK_HEIGHT)
          const incomeHeight = Math.max(2, (inc / maxMonthly) * BAR_TRACK_HEIGHT)
          return (
            <View key={`${m.year}-${m.month}`} className="flex-1 items-center gap-2">
              <View className="w-full flex-row items-end justify-center gap-1" style={{ height: BAR_TRACK_HEIGHT }}>
                <View style={{ height: incomeHeight }} className="w-3 rounded-sm bg-positive" />
                <View style={{ height: expenseHeight }} className="w-3 rounded-sm bg-primary" />
              </View>
              <Text className="text-[11px] text-muted-foreground">{m.label}</Text>
            </View>
          )
        })}
      </View>
    </Card>
  )

  const byCategory = data && data.category_breakdown.length > 0 && (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>By category</CardTitle>
        <CardDescription>This month</CardDescription>
      </CardHeader>
      <View className="gap-4 px-4 pb-4">
        {data.category_breakdown.map((c) => {
          const pct = categoryTotal > 0 ? (c.total / categoryTotal) * 100 : 0
          return (
            <View key={c.category}>
              <View className="mb-1.5 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryStyle(c.category).color }} />
                  <Text className="text-sm capitalize">{c.category}</Text>
                </View>
                <Text className="text-sm">
                  <Text className="text-sm font-medium">{formatCurrency(c.total)}</Text>
                  <Text className="text-xs text-muted-foreground">  {Math.round(pct)}%</Text>
                </Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <View style={{ width: `${pct}%`, backgroundColor: categoryStyle(c.category).color }} className="h-full rounded-full" />
              </View>
            </View>
          )
        })}
      </View>
    </Card>
  )

  const merchants = data && data.top_merchants.length > 0 && (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>Top merchants</CardTitle>
      </CardHeader>
      {data.top_merchants.map((merchant, index) => (
        <View
          key={merchant.merchant}
          className={cn("flex-row items-center justify-between px-4 py-3", index < data.top_merchants.length - 1 && "border-b border-border")}
        >
          <View className="flex-1">
            <Text numberOfLines={1} className="text-sm font-medium">{merchant.merchant}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {merchant.count} transaction{merchant.count === 1 ? "" : "s"}
            </Text>
          </View>
          <Text className="text-sm font-medium">{formatCurrency(merchant.total)}</Text>
        </View>
      ))}
    </Card>
  )

  // Spend split by account and by method — the numbers to hold up against
  // a single bank's or a single UPI app's own "spent this month".
  const breakdownCard = (
    title: string,
    description: string,
    rows: { key: string; label: string; total: number; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }[]
  ) => {
    if (rows.length === 0) return null
    const total = rows.reduce((sum, r) => sum + r.total, 0)
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <View className="gap-4 px-4 pb-4">
          {rows.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0
            return (
              <View key={r.key}>
                <View className="mb-1.5 flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Ionicons name={r.icon} size={14} color={colors.mutedForeground} />
                    <Text numberOfLines={1} className="flex-1 text-sm">{r.label}</Text>
                  </View>
                  <Text className="text-sm font-medium">{formatCurrency(r.total)}</Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <View style={{ width: `${pct}%` }} className="h-full rounded-full bg-primary" />
                </View>
              </View>
            )
          })}
        </View>
      </Card>
    )
  }

  const byAccount =
    data &&
    filters.accountId === undefined &&
    breakdownCard(
      "By account",
      "Spent this month",
      data.account_breakdown.map((a) => ({
        key: String(a.account_id ?? "none"),
        label: a.name,
        total: a.total,
        icon: a.account_id === null ? "help-circle-outline" : a.type === "credit_card" ? "card-outline" : "business-outline"
      }))
    )

  const byMethod =
    data &&
    filters.paymentMethod === undefined &&
    breakdownCard(
      "By payment method",
      "Spent this month",
      data.payment_method_breakdown.map((m) => ({
        key: m.payment_method ?? "unknown",
        label: paymentMethodLabel(m.payment_method),
        total: m.total,
        icon: paymentMethodIcon(m.payment_method)
      }))
    )

  const accountOptions = [
    { value: -1, label: "All accounts" },
    ...(accounts ?? []).map((a) => ({ value: a.id, label: a.name })),
    { value: 0, label: "Not linked" }
  ]
  const methodOptions: { value: PaymentMethod | "all"; label: string }[] = [
    { value: "all", label: "All methods" },
    ...PAYMENT_METHODS.map((m) => ({ value: m, label: paymentMethodLabel(m) }))
  ]

  const filterBar = (
    <View className="gap-2">
      {!!accounts?.length && (
        <ChipGroup
          scroll
          options={accountOptions}
          value={filters.accountId ?? -1}
          onChange={(v) => setFilters((f) => ({ ...f, accountId: v === -1 ? undefined : v }))}
        />
      )}
      <ChipGroup
        scroll
        options={methodOptions}
        value={filters.paymentMethod ?? "all"}
        onChange={(v) => setFilters((f) => ({ ...f, paymentMethod: v === "all" ? undefined : v }))}
      />
      {filters.paymentMethod === "upi" && (
        <Text className="text-xs text-muted-foreground">
          Google Pay and other UPI apps only count UPI payments made in that app — card, ATM, autopay and bank transfers aren&apos;t in their total.
        </Text>
      )}
    </View>
  )

  const subscriptions = recurring && (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>
          {recurring.items.length > 0
            ? `${formatCurrency(recurring.monthly_total)}/month across ${recurring.items.length} recurring bill${recurring.items.length === 1 ? "" : "s"}`
            : "Nothing detected yet — recurring charges show up after a few regular payments."}
        </CardDescription>
      </CardHeader>
      <View className="border-t border-border">
        <LinkRow label="View subscriptions" icon="repeat-outline" onPress={() => router.push("/(modals)/recurring")} last />
      </View>
    </Card>
  )

  return (
    <Page>
      <PageHeader title="Insights" description="Where your money goes." />

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load insights" onRetry={refetch} />
      ) : isFiltered && !hasAnySpend ? (
        <View className="gap-6">
          {filterBar}
          <EmptyState icon="funnel-outline" title="Nothing here" subtitle="No transactions match this filter yet." />
        </View>
      ) : !data || !hasAnySpend ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No data yet"
          subtitle="Add or import some transactions to see your trends here."
          actionLabel="Add transaction"
          onAction={() => router.push("/(modals)/add-expense")}
        />
      ) : isDesktop ? (
        <View className="gap-6">
          {filterBar}
          {summary}
          {trend}
          <View className="flex-row items-start gap-6">
            <View className="flex-1 gap-6">
              {byCategory}
              {byAccount}
            </View>
            <View className="flex-1 gap-6">
              {byMethod}
              {merchants}
              {subscriptions}
            </View>
          </View>
        </View>
      ) : (
        <View className="gap-6">
          {filterBar}
          {summary}
          {trend}
          {byMethod}
          {byAccount}
          {byCategory}
          {merchants}
          {subscriptions}
        </View>
      )}
    </Page>
  )
}
