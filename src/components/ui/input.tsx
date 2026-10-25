import { useState, type ReactNode, type Ref } from "react"
import { TextInput, View, type TextInputProps } from "react-native"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"

type InputProps = TextInputProps & {
  ref?: Ref<TextInput>
  /** Rendered inside the field, before the text (typically an icon or "₹"). */
  leading?: ReactNode
  /** Rendered inside the field, after the text (e.g. a show-password toggle). */
  trailing?: ReactNode
  invalid?: boolean
  containerClassName?: string
}

/**
 * The border/focus ring lives on a wrapper View rather than the TextInput
 * so leading/trailing adornments sit inside the same outlined field.
 * Focus is tracked in state instead of a `focus:` variant, which NativeWind
 * only applies reliably on web.
 */
function Input({
  ref,
  className,
  containerClassName,
  leading,
  trailing,
  invalid = false,
  editable = true,
  multiline,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)

  return (
    <View
      className={cn(
        "flex-row items-center gap-2 rounded-md border bg-background px-3 web:transition-colors",
        multiline ? "min-h-[80px] items-start py-2" : "h-10",
        invalid ? "border-destructive" : focused ? "border-ring" : "border-input",
        !editable && "opacity-60",
        containerClassName
      )}
    >
      {leading}
      <TextInput
        ref={ref}
        editable={editable}
        multiline={multiline}
        placeholderTextColor={colors.mutedForeground}
        aria-invalid={invalid}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        className={cn("flex-1 text-sm text-foreground web:outline-none", multiline ? "min-h-[64px]" : "h-full", className)}
        style={multiline ? { textAlignVertical: "top" } : undefined}
        {...props}
      />
      {trailing}
    </View>
  )
}

export { Input }
export type { InputProps }
