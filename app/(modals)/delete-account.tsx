import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"

const CONFIRM_WORD = "DELETE"

export default function DeleteAccountScreen() {
  const { logout } = useUserStore()
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = confirmText.trim() === CONFIRM_WORD

  const handleDelete = () => {
    Alert.alert(
      "Delete account?",
      "This is your last chance to back out. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true)
            try {
              await authApi.deleteMe()
              await logout()
              router.replace("/(auth)/login")
            } catch (error: any) {
              Alert.alert("Error", error?.response?.data?.detail || "Failed to delete account")
              setIsDeleting(false)
            }
          }
        }
      ]
    )
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Delete Account</Text>
        <TouchableOpacity onPress={() => router.back()} disabled={isDeleting}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        <GlassCard className="p-4 mb-6 border-red-200 dark:border-red-500/20">
          <Text className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
            This permanently deletes:
          </Text>
          <Text className="text-sm text-neutral-700 dark:text-neutral-300 leading-5">
            • Your account and profile{"\n"}
            • Every transaction, manual and imported{"\n"}
            • All budgets{"\n"}
            • Your Gmail connection
          </Text>
        </GlassCard>

        <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
          Type {CONFIRM_WORD} to confirm
        </Text>
        <TextInput
          placeholder={CONFIRM_WORD}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
          placeholderTextColor="#9ca3af"
        />
      </ScrollView>

      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          onPress={handleDelete}
          disabled={!canDelete || isDeleting}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            canDelete && !isDeleting ? "bg-red-600" : "bg-neutral-200 dark:bg-neutral-800"
          }`}
        >
          {isDeleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className={`text-base font-semibold ${canDelete ? "text-white" : "text-neutral-400"}`}>
              Delete My Account
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isDeleting}
          className="w-full items-center justify-center border border-border dark:border-white/15 rounded-2xl py-4"
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
