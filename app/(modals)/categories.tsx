import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { categoriesApi } from "@/api/endpoints/categories"
import { useCategories } from "@/hooks/useCategories"
import { Category } from "@/types/domain"
import { ErrorState } from "@/components/shared/ErrorState"
import { GlowBackground } from "@/components/shared/GlowBackground"
import { GlassCard } from "@/components/shared/GlassCard"

function errorDetail(error: any, fallback: string): string {
  return error?.response?.data?.detail || fallback
}

function CategoryRow({ category }: { category: Category }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon)

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: () => categoriesApi.update(category.id, { name: name.trim(), icon: icon.trim() || "📌" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      setIsEditing(false)
    },
    onError: (error: any) => Alert.alert("Couldn't save", errorDetail(error, "Failed to update category"))
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => categoriesApi.remove(category.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: (error: any) => Alert.alert("Couldn't delete", errorDetail(error, "Failed to delete category"))
  })

  const handleDelete = () => {
    Alert.alert(
      "Delete category",
      `Delete "${category.name}"? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => remove() }
      ]
    )
  }

  if (category.is_default) {
    return (
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border dark:border-white/10">
        <View className="flex-row items-center gap-3">
          <Text className="text-lg">{category.icon}</Text>
          <Text className="text-sm font-medium text-neutral-900 dark:text-white capitalize">{category.name}</Text>
        </View>
        <Text className="text-xs text-muted dark:text-neutral-500">Default</Text>
      </View>
    )
  }

  if (isEditing) {
    return (
      <View className="px-4 py-3 border-b border-border dark:border-white/10 gap-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            value={icon}
            onChangeText={setIcon}
            className="w-14 text-center border border-border dark:border-white/15 dark:bg-white/5 rounded-xl py-2 text-lg text-neutral-900 dark:text-white"
            maxLength={4}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            className="flex-1 border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-2 text-sm text-neutral-900 dark:text-white"
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => update()}
            disabled={isUpdating || !name.trim()}
            className="flex-1 items-center py-2 rounded-xl bg-primary-600 dark:bg-accent-600"
          >
            {isUpdating ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text className="text-sm font-semibold text-white">Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setName(category.name)
              setIcon(category.icon)
              setIsEditing(false)
            }}
            disabled={isUpdating}
            className="flex-1 items-center py-2 rounded-xl border border-border dark:border-white/15"
          >
            <Text className="text-sm font-semibold text-neutral-900 dark:text-white">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-border dark:border-white/10">
      <TouchableOpacity onPress={() => setIsEditing(true)} className="flex-row items-center gap-3 flex-1">
        <Text className="text-lg">{category.icon}</Text>
        <Text className="text-sm font-medium text-neutral-900 dark:text-white capitalize">{category.name}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDelete} disabled={isDeleting} className="px-2 py-1">
        {isDeleting ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <Text className="text-sm font-medium text-red-600 dark:text-red-400">Delete</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

export default function CategoriesScreen() {
  const { data: categories, isLoading, error, refetch } = useCategories()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState("")

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => categoriesApi.create({ name: newName.trim(), icon: newIcon.trim() || "📌" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      setNewName("")
      setNewIcon("")
    },
    onError: (error: any) => Alert.alert("Couldn't add category", errorDetail(error, "Failed to create category"))
  })

  const defaults = categories?.filter(c => c.is_default) ?? []
  const custom = categories?.filter(c => !c.is_default) ?? []

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-white dark:bg-transparent">
      <GlowBackground />
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-white">Categories</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-base text-primary-600 dark:text-accent-400">✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load categories" onRetry={refetch} />
      ) : (
        <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Add a category</Text>
            <View className="flex-row items-center gap-2">
              <TextInput
                value={newIcon}
                onChangeText={setNewIcon}
                placeholder="📌"
                className="w-14 text-center border border-border dark:border-white/15 dark:bg-white/5 rounded-xl py-3 text-lg text-neutral-900 dark:text-white"
                maxLength={4}
              />
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g., Side Hustle"
                className="flex-1 border border-border dark:border-white/15 dark:bg-white/5 rounded-xl px-3 py-3 text-sm text-neutral-900 dark:text-white"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                onPress={() => create()}
                disabled={isCreating || !newName.trim()}
                className={`items-center justify-center px-4 py-3 rounded-xl ${
                  isCreating || !newName.trim() ? "bg-neutral-200 dark:bg-neutral-800" : "bg-primary-600 dark:bg-accent-600"
                }`}
              >
                {isCreating ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text className="text-sm font-semibold text-white">Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {custom.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Custom</Text>
              <GlassCard>
                {custom.map(category => <CategoryRow key={category.id} category={category} />)}
              </GlassCard>
            </View>
          )}

          <View className="mb-8">
            <Text className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Default</Text>
            <GlassCard>
              {defaults.map(category => <CategoryRow key={category.id} category={category} />)}
            </GlassCard>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
