import { router } from "expo-router"
import { useState } from "react"
import { useExportTransactions } from "@/hooks/useExportTransactions"
import { showAlert } from "@/utils/alert"
import { useCategories } from "@/hooks/useCategories"
import { DateRange, DATE_RANGES, dateFromForRange } from "@/utils/dateRanges"
import { ModalScreen } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { ChipGroup, Field } from "@/components/ui/misc"

const TYPES = [
  { value: "all", label: "All" },
  { value: "debit", label: "Expenses" },
  { value: "credit", label: "Income" }
]

const SOURCES = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "gmail", label: "Gmail" },
  { value: "sms", label: "SMS" },
  { value: "aa", label: "Account aggregator" },
  { value: "statement", label: "Bank statement" }
]

export default function ExportScreen() {
  const { exportCsv, isExporting } = useExportTransactions()
  const { data: categories } = useCategories()
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
      showAlert("Export failed", result.error)
    }
  }

  return (
    <ModalScreen
      title="Export transactions"
      footer={
        <Button onPress={handleExport} loading={isExporting}>
          <Text>Export CSV</Text>
        </Button>
      }
    >
      <Text className="text-sm text-muted-foreground">
        Downloads a CSV with the date, type, amount, category, merchant, note, source and recurring flag of every matching transaction.
      </Text>
      <Field label="Date range">
        <ChipGroup options={DATE_RANGES.map(r => ({ value: r.key, label: r.label }))} value={dateRange} onChange={setDateRange} />
      </Field>
      <Field label="Type">
        <ChipGroup options={TYPES} value={type} onChange={setType} />
      </Field>
      <Field label="Source">
        <ChipGroup options={SOURCES} value={source} onChange={setSource} />
      </Field>
      <Field label="Category">
        <ChipGroup
          options={[{ value: "all", label: "All" }, ...(categories?.map(c => ({ value: c.name, label: c.name.charAt(0).toUpperCase() + c.name.slice(1) })) ?? [])]}
          value={category}
          onChange={setCategory}
        />
      </Field>
    </ModalScreen>
  )
}
