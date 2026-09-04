import { Text, TouchableOpacity } from "react-native"

interface ChipProps {
  label: string
  selected: boolean
  onPress: () => void
  /** Extra layout classes on the pressable itself, e.g. "flex-1" for a chip in an equal-width row. */
  className?: string
  /** Override the default px-4 py-2 padding (e.g. a segmented-style row wants py-3 and no horizontal padding of its own). */
  padding?: string
  /** Override the default rounded-full (e.g. a taller segmented-style chip reads better as rounded-2xl than a full pill). Kept as a single prop rather than folded into `className` — two conflicting `rounded-*` utilities in one class string race on CSS source order, not string order, so whichever "wins" isn't predictable. */
  rounded?: string
  /** Most chips (category, type, period...) are stored lowercase and want each word capitalized for display — but a few (account names, currency codes) are already user-authored/proper-cased and shouldn't be transformed. */
  capitalize?: boolean
  /** A denser chip row (account type, currency) reads better at text-xs than the text-sm default. */
  textSize?: string
}

/**
 * The single-select pill button used everywhere a form offers a small set
 * of choices (category, account, date range, type, currency, period...).
 * Consolidating it here means the hover/cursor treatment below only had to
 * be written once, instead of re-added to every place this pattern was
 * copy-pasted — those places previously gave desktop/mouse users no
 * indication an unselected chip was clickable at all.
 */
export function Chip({
  label,
  selected,
  onPress,
  className = "",
  padding = "px-4 py-2",
  rounded = "rounded-full",
  capitalize = true,
  textSize = "text-sm"
}: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`${padding} ${rounded} cursor-pointer transition-colors duration-150 ${
        selected
          ? "bg-primary-600 dark:bg-accent-600"
          : "bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/20"
      } ${className}`}
    >
      <Text
        className={`${textSize} font-medium text-center ${capitalize ? "capitalize" : ""} ${
          selected ? "text-white" : "text-neutral-700 dark:text-neutral-300"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}
