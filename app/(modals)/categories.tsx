import { useState } from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { categoriesApi } from "@/api/endpoints/categories"
import { useCategories } from "@/hooks/useCategories"
import { Category } from "@/types/domain"
import { confirm } from "@/utils/confirm"
import { extractErrorMessage as errorDetail } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { invalidateTransactionQueries } from "@/api/invalidate"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { ErrorState } from "@/components/shared/ErrorState"
import { ModalScreen, SectionTitle } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"

function CategoryRow({ category, last }: { category: Category; last: boolean }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon)

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: () => categoriesApi.update(category.id, { name: name.trim(), icon: icon.trim() || "📌" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      // A rename cascades onto existing transactions and budgets server-side.
      invalidateTransactionQueries(queryClient)
      setIsEditing(false)
    },
    onError: (error: any) => showAlert("Couldn't save", errorDetail(error, "Failed to update category"))
  })

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: () => categoriesApi.remove(category.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
    onError: (error: any) => showAlert("Couldn't delete", errorDetail(error, "Failed to delete category"))
  })

  const handleDelete = async () => {
    const confirmed = await confirm("Delete category", `Delete "${category.name}"? This can't be undone.`, {
      confirmLabel: "Delete",
      destructive: true
    })
    if (confirmed) remove()
  }

  const rowClass = cn("min-h-[48px] flex-row items-center gap-3 px-4 py-2.5", !last && "border-b border-border")

  if (isEditing) {
    return (
      <View className={cn("gap-2 p-4", !last && "border-b border-border")}>
        <View className="flex-row gap-2">
          <Input value={icon} onChangeText={setIcon} maxLength={4} containerClassName="w-14" className="text-center" accessibilityLabel="Icon" />
          <Input value={name} onChangeText={setName} containerClassName="flex-1" accessibilityLabel="Category name" />
        </View>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={isUpdating}
            onPress={() => {
              setName(category.name)
              setIcon(category.icon)
              setIsEditing(false)
            }}
          >
            <Text>Cancel</Text>
          </Button>
          <Button size="sm" className="flex-1" onPress={() => update()} loading={isUpdating} disabled={!name.trim()}>
            <Text>Save</Text>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className={rowClass}>
      <Text className="w-6 text-center text-base">{category.icon}</Text>
      <Text className="flex-1 text-sm capitalize">{category.name}</Text>
      {category.is_default ? (
        <Text className="text-xs text-muted-foreground">Default</Text>
      ) : (
        <View className="flex-row gap-4">
          <Pressable onPress={() => setIsEditing(true)} accessibilityRole="button" accessibilityLabel={`Edit ${category.name} category`} hitSlop={6} className="web:cursor-pointer">
            <Text className="text-xs font-medium text-muted-foreground">Edit</Text>
          </Pressable>
          <Pressable onPress={handleDelete} disabled={isDeleting} accessibilityRole="button" accessibilityLabel={`Delete ${category.name} category`} hitSlop={6} className="web:cursor-pointer">
            <Text className={cn("text-xs font-medium text-destructive", isDeleting && "opacity-50")}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export default function CategoriesScreen() {
  const { data: categories, isLoading, error, refetch } = useCategories()
  const queryClient = useQueryClient()
  const { colors } = useTheme()
  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState("")

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: () => categoriesApi.create({ name: newName.trim(), icon: newIcon.trim() || "📌" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
      setNewName("")
      setNewIcon("")
    },
    onError: (error: any) => showAlert("Couldn't add category", errorDetail(error, "Failed to create category"))
  })

  const defaults = categories?.filter(c => c.is_default) ?? []
  const custom = categories?.filter(c => !c.is_default) ?? []

  return (
    <ModalScreen title="Categories">
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      ) : error ? (
        <ErrorState message="Failed to load categories" onRetry={refetch} />
      ) : (
        <>
          <View>
            <SectionTitle title="Add a category" />
            <View className="flex-row gap-2">
              <Input value={newIcon} onChangeText={setNewIcon} placeholder="📌" maxLength={4} containerClassName="w-14" className="text-center" accessibilityLabel="Icon" />
              <Input value={newName} onChangeText={setNewName} placeholder="e.g. Side hustle" containerClassName="flex-1" accessibilityLabel="Category name" />
              <Button onPress={() => create()} loading={isCreating} disabled={!newName.trim()}>
                <Text>Add</Text>
              </Button>
            </View>
          </View>

          {custom.length > 0 && (
            <View>
              <SectionTitle title="Custom" />
              <Card>
                {custom.map((c, i) => <CategoryRow key={c.id} category={c} last={i === custom.length - 1} />)}
              </Card>
            </View>
          )}

          <View>
            <SectionTitle title="Default" />
            <Card>
              {defaults.map((c, i) => <CategoryRow key={c.id} category={c} last={i === defaults.length - 1} />)}
            </Card>
          </View>
        </>
      )}
    </ModalScreen>
  )
}
