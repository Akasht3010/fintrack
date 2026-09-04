import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { useExportTransactions } from "@/hooks/useExportTransactions"
import { useCategories } from "@/hooks/useCategories"
import { DateRange, DATE_RANGES, dateFromForRange } from "@/utils/dateRanges"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"
import { Chip } from "@/components/shared/Chip"

const TYPES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "debit", label: "Expenses" },
  { key: "credit", label: "Credit" }
]

const SOURCES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "manual", label: "Manual" },
  { key: "gmail", label: "Gmail" },
  { key: "sms", label: "SMS" },
  { key: "aa", label: "Account Aggregator" }
]

function ChipRow<T extends string>({
  options,
  value,
  onChange
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (key: T) => void
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.key} label={option.label} selected={value === option.key} onPress={() => onChange(option.key)} />
      ))}
    </View>
  )
}

export default function ExportScreen() {
  const { exportCsv, isExporting } = useExportTransactions()
  const { data: categories } = useCategories()
  const categoryFilters = ["all", ...(categories?.map(c => c.name) ?? [])]
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [type, setType] = useState("all")
  const [source, setSource] = useState("all")
  const [category, setCategory] = useState("all")

  const handleExport = async () => {
    const result = await exportCsv({
      date_from: dateFromForRange(dateRange),
      type: type === "all" ? undefined : type,
      source: source === "all" ? undefined : source,
      category: category === "all" ? undefined : category
    })
    if (result.success) {
      router.back()
    } else if (result.error) {
      Alert.alert("Export failed", result.error)
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Export Transactions</Text>
        <TouchableOpacity onPress={() => router.back()} className="cursor-pointer hover:opacity-70 transition-opacity duration-150">
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Date range</Text>
          <ChipRow options={DATE_RANGES} value={dateRange} onChange={setDateRange} />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Type</Text>
          <ChipRow options={TYPES} value={type} onChange={setType} />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Source</Text>
          <ChipRow options={SOURCES} value={source} onChange={setSource} />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {categoryFilters.map((cat) => (
              <Chip key={cat} label={cat} selected={category === cat} onPress={() => setCategory(cat)} />
            ))}
          </View>
        </View>

        <GlassCard className="p-4 mb-6">
          <Text className="text-xs text-muted dark:text-neutral-400">
            Exports a CSV with the date, type, amount, category, merchant, description, source, and recurring flag for every matching transaction.
          </Text>
        </GlassCard>
      </ScrollView>

      <View className="px-6 pb-8">
        <TouchableOpacity
          onPress={handleExport}
          disabled={isExporting}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            isExporting
              ? "bg-neutral-200 dark:bg-neutral-800"
              : "bg-primary-600 dark:bg-accent-600 cursor-pointer hover:opacity-90 transition-opacity duration-150"
          }`}
        >
          {isExporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Export CSV</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
