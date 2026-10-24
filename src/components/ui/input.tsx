import { useState, type ReactNode, type Ref } from "react"
import { TextInput, View, type TextInputProps } from "react-native"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"

type InputProps = TextInputProps & {
  ref?: Ref<TextInput>
  /** Rendered inside the field, before the text (typically an icon). */
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
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme()
  const [focused, setFocused] = useState(false)

  return (
    <View
      className={cn(
        "h-12 flex-row items-center gap-2 rounded-xl border bg-background px-3.5 web:transition-colors",
        invalid ? "border-destructive" : focused ? "border-ring" : "border-input",
        !editable && "opacity-60",
        containerClassName
      )}
    >
      {leading}
      <TextInput
        ref={ref}
        editable={editable}
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
        className={cn("h-full flex-1 text-base text-foreground web:outline-none", className)}
        {...props}
      />
      {trailing}
    </View>
  )
}

export { Input }
export type { InputProps }
