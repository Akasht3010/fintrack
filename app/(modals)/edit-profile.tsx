import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { storage as SecureStore } from "@/utils/storage"
import { isValidEmail, isValidPhone } from "@/utils/identifier"
import { GlowBackground } from "@/components/shared/GlowBackground"

export default function EditProfileScreen() {
  const { user, setUser } = useUserStore()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name")
      return
    }
    if (!isValidEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address")
      return
    }
    if (phone.trim() && !isValidPhone(phone)) {
      Alert.alert("Error", "Phone number must be 10 digits")
      return
    }

    setIsSaving(true)
    try {
      const updated = await authApi.updateMe({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined
      })
      await SecureStore.setItemAsync("user", JSON.stringify(updated))
      setUser(updated)
      router.back()
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.detail || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Edit Profile</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Name</Text>
          <TextInput
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Email</Text>
          <TextInput
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Phone (optional)</Text>
          <TextInput
            placeholder="10-digit phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            className="border border-border dark:border-white/15 dark:bg-white/5 rounded-2xl px-4 py-3 text-base text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </ScrollView>

      <View className="px-6 pb-8 gap-3">
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          className={`w-full items-center justify-center rounded-2xl py-4 ${
            isSaving ? "bg-neutral-200 dark:bg-neutral-800" : "bg-primary-600 dark:bg-accent-600"
          }`}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Save Changes</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          disabled={isSaving}
          className="w-full items-center justify-center border border-border dark:border-white/15 rounded-2xl py-4"
        >
          <Text className="text-base font-semibold text-neutral-900 dark:text-white">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
