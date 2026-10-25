import { View, type ViewProps, type TextProps } from "react-native"
import { cn } from "@/lib/utils"
import { Text } from "./text"

function Card({ className, ...props }: ViewProps) {
  return <View className={cn("rounded-lg border border-border bg-card", className)} {...props} />
}

function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn("gap-0.5 px-4 pb-2 pt-4", className)} {...props} />
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-[15px] font-semibold text-card-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn("text-[13px] text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("px-4 pb-4", className)} {...props} />
}

function CardFooter({ className, ...props }: ViewProps) {
  return <View className={cn("flex-row items-center px-4 pb-4", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
