import { router } from "expo-router"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { storage as SecureStore } from "@/utils/storage"
import { isValidEmail, isValidPhone } from "@/utils/identifier"
import { showAlert } from "@/utils/alert"
import { ModalScreen } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Field } from "@/components/ui/misc"

export default function EditProfileScreen() {
  const { user, setUser } = useUserStore()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [phone, setPhone] = useState(user?.phone ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert("Error", "Please enter your name")
      return
    }
    if (!isValidEmail(email)) {
      showAlert("Error", "Please enter a valid email address")
      return
    }
    if (phone.trim() && !isValidPhone(phone)) {
      showAlert("Error", "Phone number must be 10 digits")
      return
    }

    setIsSaving(true)
    try {
      const updated = await authApi.updateMe({
        name: name.trim(),
        phone: phone.trim() || undefined
      })
      await SecureStore.setItemAsync("user", JSON.stringify(updated))
      setUser(updated)

      // A new email only takes effect once the code sent to it comes back.
      const newEmail = email.trim().toLowerCase()
      if (newEmail !== updated.email) {
        const pending = await authApi.requestEmailChange(newEmail)
        router.replace({
          pathname: "/(auth)/verify-otp",
          params: { pendingToken: pending.pending_token, emailHint: pending.email_hint, flow: "email-change" }
        })
        return
      }
      router.back()
    } catch (error: any) {
      showAlert("Error", extractErrorMessage(error, "Failed to update profile"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModalScreen
      title="Edit profile"
      closeDisabled={isSaving}
      footer={
        <Button onPress={handleSave} loading={isSaving}>
          <Text>Save changes</Text>
        </Button>
      }
    >
      <Field label="Name">
        <Input accessibilityLabel="Name" placeholder="Your name" value={name} onChangeText={setName} autoComplete="name" />
      </Field>
      <Field label="Email" hint="Changing it sends a verification code to the new address.">
        <Input
          accessibilityLabel="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </Field>
      <Field label="Phone" hint="Optional">
        <Input accessibilityLabel="Phone" placeholder="10-digit mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Field>
    </ModalScreen>
  )
}
