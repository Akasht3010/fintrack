import type { Ionicons } from "@expo/vector-icons"
import { PaymentMethod } from "@/types/domain"

type IconName = keyof typeof Ionicons.glyphMap

export const PAYMENT_METHODS: PaymentMethod[] = ["upi", "card", "netbanking", "atm", "autopay", "cash", "other"]

const STYLES: Record<PaymentMethod, { label: string; icon: IconName }> = {
  upi: { label: "UPI", icon: "phone-portrait-outline" },
  card: { label: "Card", icon: "card-outline" },
  netbanking: { label: "Bank transfer", icon: "swap-horizontal-outline" },
  atm: { label: "ATM", icon: "cash-outline" },
  autopay: { label: "Autopay", icon: "repeat-outline" },
  cash: { label: "Cash", icon: "wallet-outline" },
  other: { label: "Other", icon: "ellipsis-horizontal-circle-outline" }
}

export function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  return method ? STYLES[method].label : "Unknown"
}

export function paymentMethodIcon(method: PaymentMethod | null | undefined): IconName {
  return method ? STYLES[method].icon : "help-circle-outline"
}

/** "HDFC ••1234" — how an account is told apart from others of the same type. */
export function maskedDigits(digits: string | null | undefined): string {
  return digits ? `••${digits}` : ""
}
