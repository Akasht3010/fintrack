import { useEffect } from "react"
import { View, type ViewProps, type TextProps } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Text, TextClassContext } from "./text"

function Label({ className, ...props }: TextProps) {
  return <Text className={cn("text-sm font-medium text-foreground", className)} {...props} />
}

const badgeVariants = cva("flex-row items-center self-start rounded-full border px-2.5 py-0.5", {
  variants: {
    variant: {
      default: "border-transparent bg-primary",
      secondary: "border-transparent bg-secondary",
      outline: "border-border",
      positive: "border-transparent bg-positive/10",
      negative: "border-transparent bg-negative/10"
    }
  },
  defaultVariants: { variant: "default" }
})

const badgeTextVariants = cva("text-xs font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      outline: "text-foreground",
      positive: "text-positive",
      negative: "text-negative"
    }
  },
  defaultVariants: { variant: "default" }
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

/**
 * Loading placeholder with a gentle pulse. The pulse runs on an outer
 * style-only Animated.View because NativeWind doesn't apply className to
 * Animated components; the shape/size classes go on the inner View.
 */
function Skeleton({ className, ...props }: ViewProps) {
  const reduceMotion = useReducedMotion()
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (reduceMotion) return
    opacity.value = withRepeat(withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [opacity, reduceMotion])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={style}>
      <View className={cn("rounded-md bg-muted", className)} {...props} />
    </Animated.View>
  )
}

export { Label, Badge, badgeVariants, Separator, Skeleton }
