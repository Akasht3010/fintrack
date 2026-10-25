import { ActivityIndicator, Pressable, type PressableProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import { TextClassContext } from "./text"

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-md active:opacity-80 web:cursor-pointer web:transition-colors web:duration-150",
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
        default: "h-10 px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)

const buttonTextVariants = cva("text-sm font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-foreground underline"
    },
    size: {
      default: "",
      sm: "text-[13px]",
      lg: "text-base",
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
        {loading ? <ActivityIndicator size="small" color={spinnerColor} /> : children}
      </Pressable>
    </TextClassContext.Provider>
  )
}

export { Button, buttonVariants, buttonTextVariants }
export type { ButtonProps }
