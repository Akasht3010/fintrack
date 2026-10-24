import { View, type ViewProps, type TextProps } from "react-native"
import { cn } from "@/lib/utils"
import { Text } from "./text"

function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("rounded-2xl border border-border bg-card shadow-sm shadow-black/5", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn("gap-1 p-5", className)} {...props} />
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn("text-lg font-semibold tracking-tight text-card-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("px-5 pb-5", className)} {...props} />
}

function CardFooter({ className, ...props }: ViewProps) {
  return <View className={cn("flex-row items-center px-5 pb-5", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
