import { View, Text, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { useThemeStore, ThemeMode } from "@/store/useThemeStore"
import { useGmailConnect } from "@/hooks/useGmailConnect"
import { gmailApi } from "@/api/endpoints/gmail"
import { formatDate } from "@/utils/date"

function initialsFor(name?: string): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("")
}

const THEME_OPTIONS: ThemeMode[] = ["light", "dark", "system"]

export default function ProfileScreen() {
  const { user, logout } = useUserStore()
  const { mode, setMode } = useThemeStore()
  const { connect: connectGmail, isLoading: isConnecting } = useGmailConnect()
  const [isSyncing, setIsSyncing] = useState(false)
  const queryClient = useQueryClient()

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout()
          router.replace("/(auth)/login")
        }
      }
    ])
  }

  const handleConnectGmail = async () => {
    const result = await connectGmail()
    if (!result.success && result.error) {
      Alert.alert("Couldn't connect Gmail", result.error)
    }
  }

  const handleSyncGmail = async () => {
    setIsSyncing(true)
    try {
      const result = await gmailApi.sync()
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      Alert.alert(
        "Sync complete",
        `Imported ${result.imported} new transaction${result.imported === 1 ? "" : "s"}.\n${result.skipped_duplicate} already imported, ${result.skipped_unparsed} couldn't be read.`
      )
    } catch (error: any) {
      Alert.alert("Sync failed", error.response?.data?.detail || "Something went wrong")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-neutral-950">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View className="px-6 pt-4 pb-6">
          <Text className="text-3xl font-bold text-neutral-900 dark:text-white">Profile</Text>
        </View>

        <View className="px-6 items-center mb-8">
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              className="w-24 h-24 rounded-full mb-4"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-primary-500 items-center justify-center mb-4">
              <Text className="text-3xl font-bold text-white">
                {initialsFor(user?.name)}
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">
            {user?.name ?? "User"}
          </Text>
          <Text className="text-sm text-muted dark:text-neutral-400 mt-1">{user?.email}</Text>
        </View>

        <View className="px-6 mb-6">
          <View className="bg-white dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl overflow-hidden">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-neutral-800">
              <Text className="text-sm text-muted dark:text-neutral-400">Phone</Text>
              <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                {user?.phone || "Not added"}
              </Text>
            </View>

            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border dark:border-neutral-800">
              <Text className="text-sm text-muted dark:text-neutral-400">Gmail</Text>
              <View className={`px-3 py-1 rounded-full ${user?.gmail_connected ? "bg-primary-100 dark:bg-primary-900" : "bg-neutral-100 dark:bg-neutral-800"}`}>
                <Text className={`text-xs font-medium ${user?.gmail_connected ? "text-primary-600 dark:text-primary-400" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {user?.gmail_connected ? "Connected" : "Not connected"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between px-4 py-4">
              <Text className="text-sm text-muted dark:text-neutral-400">Member since</Text>
              <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                {user?.created_at ? formatDate(user.created_at) : "—"}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Appearance</Text>
          <View className="flex-row bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-1">
            {THEME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setMode(option)}
                className={`flex-1 items-center py-2 rounded-xl ${
                  mode === option ? "bg-white dark:bg-neutral-700" : ""
                }`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${
                    mode === option
                      ? "text-neutral-900 dark:text-white"
                      : "text-muted dark:text-neutral-400"
                  }`}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="px-6 mb-6">
          {user?.gmail_connected ? (
            <TouchableOpacity
              onPress={handleSyncGmail}
              disabled={isSyncing}
              className="w-full items-center justify-center border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl py-4"
            >
              {isSyncing ? (
                <ActivityIndicator color="#16a34a" />
              ) : (
                <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">Sync Gmail Now</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleConnectGmail}
              disabled={isConnecting}
              className="w-full items-center justify-center border border-border dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-2xl py-4"
            >
              {isConnecting ? (
                <ActivityIndicator color="#16a34a" />
              ) : (
                <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">Connect Gmail</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View className="px-6 mt-auto" style={{ paddingBottom: 140 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            className="w-full items-center justify-center border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 rounded-2xl py-4"
          >
            <Text className="text-base font-semibold text-red-600 dark:text-red-400">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
