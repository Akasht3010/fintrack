import { ActivityIndicator, Pressable, type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import { TextClassContext } from "./text"

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-xl web:cursor-pointer web:transition-colors web:duration-150 active:opacity-80",
  {
    variants: {
      variant: {
        default: "bg-primary web:hover:bg-primary/90",
        destructive: "bg-destructive web:hover:bg-destructive/90",
        outline: "border border-input bg-background web:hover:bg-accent",
        secondary: "bg-secondary web:hover:bg-secondary/70",
        ghost: "web:hover:bg-accent",
        link: ""
      },
      size: {
        default: "h-12 px-5",
        sm: "h-9 rounded-lg px-3",
        lg: "h-14 px-8",
        icon: "h-11 w-11"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)

const buttonTextVariants = cva("text-base font-semibold", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary web:hover:underline"
    },
    size: {
      default: "",
      sm: "text-sm",
      lg: "text-lg",
      icon: ""
    }
  },
  defaultVariants: { variant: "default", size: "default" }
})

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    /** Swaps the children for a spinner and blocks presses. */
    loading?: boolean
  }

function Button({ className, variant, size, loading = false, disabled, children, ...props }: ButtonProps) {
  const { colors } = useTheme()
  const isDisabled = disabled || loading
  const spinnerColor =
    variant === "default" || variant === undefined || variant === null
      ? colors.primaryForeground
      : variant === "destructive"
        ? "#ffffff"
        : colors.foreground

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!isDisabled, busy: loading }}
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size }), isDisabled && "opacity-50 web:cursor-not-allowed", className)}
        {...props}
      >
        {loading ? <ActivityIndicator color={spinnerColor} /> : children}
      </Pressable>
    </TextClassContext.Provider>
  )
}

export { Button, buttonVariants, buttonTextVariants }
export type { ButtonProps }
