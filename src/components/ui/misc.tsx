import { View, Pressable, ScrollView, type ViewProps, type TextProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Text, TextClassContext } from "./text"

function Label({ className, ...props }: TextProps) {
  return <Text className={cn("text-[13px] font-medium text-foreground", className)} {...props} />
}

/** Label + control + optional hint/error, stacked — the unit every form is built from. */
function Field({
  label,
  hint,
  error,
  children,
  className
}: {
  label?: string
  hint?: string
  error?: string | false
  children: React.ReactNode
  className?: string
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <Text className="text-xs text-destructive">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  )
}

const badgeVariants = cva("flex-row items-center self-start rounded-md border px-2 py-0.5", {
  variants: {
    variant: {
      default: "border-transparent bg-primary",
      secondary: "border-transparent bg-secondary",
      outline: "border-border",
      destructive: "border-transparent bg-destructive/10"
    }
  },
  defaultVariants: { variant: "secondary" }
})

const badgeTextVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      destructive: "text-destructive"
    }
  },
  defaultVariants: { variant: "secondary" }
})

function Badge({ className, variant, ...props }: ViewProps & VariantProps<typeof badgeVariants>) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  )
}

function Separator({ className, orientation = "horizontal", ...props }: ViewProps & { orientation?: "horizontal" | "vertical" }) {
  return (
    <View
      accessibilityRole="none"
      className={cn("shrink-0 bg-border", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  )
}

function Skeleton({ className, ...props }: ViewProps) {
  return <View className={cn("rounded-md bg-muted", className)} {...props} />
}

/** Single-select pill used for filters and pickers. */
function Chip({ label, selected, onPress, className }: { label: string; selected: boolean; onPress: () => void; className?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        "h-8 items-center justify-center rounded-md border px-3 web:cursor-pointer web:transition-colors web:duration-150",
        selected ? "border-primary bg-primary" : "border-border bg-background web:hover:bg-accent",
        className
      )}
    >
      <Text className={cn("text-[13px] font-medium", selected ? "text-primary-foreground" : "text-foreground")}>{label}</Text>
    </Pressable>
  )
}

/** A wrapping row of Chips (scrolls horizontally instead when `scroll`). */
function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  scroll = false
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  scroll?: boolean
}) {
  const chips = options.map((o) => (
    <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
  ))
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
        {chips}
      </ScrollView>
    )
  }
  return <View className="flex-row flex-wrap gap-2">{chips}</View>
}

/** iOS-style segmented control for 2–4 mutually exclusive options. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  className
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <View className={cn("h-9 flex-row rounded-md bg-secondary p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={cn(
              "flex-1 items-center justify-center rounded-[5px] web:cursor-pointer",
              active && "border border-border bg-background"
            )}
          >
            <Text className={cn("text-[13px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export { Label, Field, Badge, badgeVariants, Separator, Skeleton, Chip, ChipGroup, Segmented }
