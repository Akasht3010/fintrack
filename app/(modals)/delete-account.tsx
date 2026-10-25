import { View } from "react-native"
import { router } from "expo-router"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { confirm } from "@/utils/confirm"
import { showAlert } from "@/utils/alert"
import { ModalScreen } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field } from "@/components/ui/misc"

const CONFIRM_WORD = "DELETE"

export default function DeleteAccountScreen() {
  const { logout } = useUserStore()
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = confirmText.trim() === CONFIRM_WORD

  const handleDelete = async () => {
    const confirmed = await confirm(
      "Delete account?",
      "This is your last chance to back out. This cannot be undone.",
      { confirmLabel: "Delete forever", destructive: true }
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await authApi.deleteMe()
      await logout()
      router.replace("/(auth)/login")
    } catch (error: any) {
      showAlert("Error", extractErrorMessage(error, "Failed to delete account"))
      setIsDeleting(false)
    }
  }

  return (
    <ModalScreen
      title="Delete account"
      closeDisabled={isDeleting}
      footer={
        <Button variant="destructive" onPress={handleDelete} loading={isDeleting} disabled={!canDelete}>
          <Text>Delete my account</Text>
        </Button>
      }
    >
      <View className="gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <Text className="text-sm font-medium text-destructive">This permanently deletes:</Text>
        <Text className="text-sm leading-6 text-foreground">
          • Your account and profile{"\n"}
          • Every transaction, manual and imported{"\n"}
          • All budgets{"\n"}
          • Your Gmail connection
        </Text>
      </View>

      <Field label={`Type ${CONFIRM_WORD} to confirm`}>
        <Input
          placeholder={CONFIRM_WORD}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
        />
      </Field>
    </ModalScreen>
  )
}
