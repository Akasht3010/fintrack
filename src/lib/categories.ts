import type { Ionicons } from "@expo/vector-icons"

type IconName = keyof typeof Ionicons.glyphMap

export interface CategoryStyle {
  color: string
  icon: IconName
}

// Default categories get a fixed, recognisable color + icon. Custom ones
// fall back to a stable pick from PALETTE (hashed by name), so a category
// always renders the same color everywhere it appears.
const KNOWN: Record<string, CategoryStyle> = {
  food: { color: "#f97316", icon: "restaurant-outline" },
  groceries: { color: "#84cc16", icon: "basket-outline" },
  transport: { color: "#0ea5e9", icon: "car-outline" },
  shopping: { color: "#ec4899", icon: "bag-handle-outline" },
  entertainment: { color: "#8b5cf6", icon: "film-outline" },
  health: { color: "#ef4444", icon: "medkit-outline" },
  utilities: { color: "#eab308", icon: "flash-outline" },
  rent: { color: "#6366f1", icon: "home-outline" },
  subscriptions: { color: "#a855f7", icon: "repeat-outline" },
  transfer: { color: "#64748b", icon: "swap-horizontal-outline" },
  other: { color: "#78716c", icon: "ellipsis-horizontal" },
  salary: { color: "#16a34a", icon: "briefcase-outline" },
  freelance: { color: "#14b8a6", icon: "laptop-outline" },
  gift: { color: "#d946ef", icon: "gift-outline" },
  refund: { color: "#06b6d4", icon: "return-down-back-outline" },
  interest: { color: "#10b981", icon: "trending-up-outline" }
}

const PALETTE = ["#f97316", "#0ea5e9", "#ec4899", "#8b5cf6", "#eab308", "#14b8a6", "#6366f1", "#ef4444", "#84cc16", "#06b6d4"]

export function categoryStyle(name: string): CategoryStyle {
  const key = name.trim().toLowerCase()
  const known = KNOWN[key]
  if (known) return known
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return { color: PALETTE[Math.abs(hash) % PALETTE.length], icon: "pricetag-outline" }
}

/** `#rrggbb` + alpha → `#rrggbbaa`, for soft tinted badge backgrounds. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0")
}
