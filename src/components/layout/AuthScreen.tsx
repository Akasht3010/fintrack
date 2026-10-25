import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import type { ReactNode } from "react"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { BrandMark } from "@/components/shared/BrandMark"
import { Text } from "@/components/ui/text"

/**
 * Shared frame for the (auth) screens: wordmark (phones only — on desktop
 * the layout shows it above the card), title, subtitle, form, footer.
 */
export function AuthScreen({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const isDesktop = useIsDesktop()
  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-background">
      <StatusBar style="auto" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[380px] flex-1 justify-center self-center px-6 py-10 md:px-8">
            {!isDesktop && (
              <View className="mb-10 flex-row items-center gap-2">
                <BrandMark size={26} />
                <Text className="text-base font-semibold tracking-tight">Fintrack</Text>
              </View>
            )}
            <Text accessibilityRole="header" className="text-2xl font-semibold tracking-tight">
              {title}
            </Text>
            {subtitle && <Text className="mt-1.5 text-sm leading-5 text-muted-foreground">{subtitle}</Text>}
            <View className="mt-8 gap-4">{children}</View>
            {footer && <View className="mt-8 gap-3">{footer}</View>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
