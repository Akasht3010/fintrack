import { View, Image, Platform } from "react-native"
import { router } from "expo-router"
import { useState } from "react"
import { useUserStore } from "@/store/useUserStore"
import { useThemeStore, ThemeMode } from "@/store/useThemeStore"
import { useGmailConnect } from "@/hooks/useGmailConnect"
import { useGmailSync } from "@/hooks/useGmailSync"
import { useSmsSync } from "@/hooks/useSmsSync"
import { useIsDesktop } from "@/hooks/useIsDesktop"
import { gmailApi } from "@/api/endpoints/gmail"
import { authApi } from "@/api/endpoints/auth"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { storage as SecureStore } from "@/utils/storage"
import { formatDate } from "@/utils/date"
import { confirm } from "@/utils/confirm"
import { initialsFor } from "@/components/shared/TopNav"
import { Page, PageHeader, SectionTitle, InfoRow, LinkRow } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import { Badge, Segmented } from "@/components/ui/misc"

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
]

export default function SettingsScreen() {
  const { user, logout, setUser } = useUserStore()
  const { mode, setMode } = useThemeStore()
  const { connect: connectGmail, isLoading: isConnecting } = useGmailConnect()
  const { sync: syncGmail, isSyncing } = useGmailSync()
  const { sync: syncSms, isSyncing: isSyncingSms } = useSmsSync()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const isDesktop = useIsDesktop()

  const handleSignOut = async () => {
    const confirmed = await confirm("Sign out", "Are you sure you want to sign out?", {
      confirmLabel: "Sign out",
      destructive: true
    })
    if (!confirmed) return
    await logout()
    router.replace("/(auth)/login")
  }

  const handleConnectGmail = async () => {
    const result = await connectGmail()
    if (!result.success && result.error) {
      showAlert("Couldn't connect Gmail", result.error)
    }
  }

  const handleDisconnectGmail = async () => {
    const confirmed = await confirm(
      "Disconnect Gmail",
      "Fintrack will stop syncing new transactions from Gmail. Transactions already imported won't be removed.",
      { confirmLabel: "Disconnect", destructive: true }
    )
    if (!confirmed) return

    setIsDisconnecting(true)
    try {
      await gmailApi.disconnect()
      const refreshed = await authApi.getMe()
      await SecureStore.setItemAsync("user", JSON.stringify(refreshed))
      setUser(refreshed)
    } catch (error: any) {
      showAlert("Error", extractErrorMessage(error, "Failed to disconnect Gmail"))
    } finally {
      setIsDisconnecting(false)
    }
  }

  const account = (
    <View>
      <SectionTitle title="Account" />
      <Card>
        <View className="flex-row items-center gap-3 border-b border-border p-4">
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} className="h-11 w-11 rounded-full" />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-full bg-secondary">
              <Text className="text-sm font-medium">{initialsFor(user?.name)}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text numberOfLines={1} className="text-[15px] font-medium">{user?.name ?? "User"}</Text>
            <Text numberOfLines={1} className="text-[13px] text-muted-foreground">{user?.email}</Text>
          </View>
          <Button variant="outline" size="sm" onPress={() => router.push("/(modals)/edit-profile")}>
            <Text>Edit</Text>
          </Button>
        </View>
        <InfoRow label="Phone" value={user?.phone || "Not added"} />
        <InfoRow label="Member since" value={user?.created_at ? formatDate(user.created_at) : "—"} last />
      </Card>
    </View>
  )

  const appearance = (
    <View>
      <SectionTitle title="Appearance" />
      <Segmented options={THEME_OPTIONS} value={mode} onChange={setMode} />
    </View>
  )

  const connections = (
    <View>
      <SectionTitle title="Connections" />
      <Card>
        <View className="flex-row items-center gap-3 p-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-medium">Gmail</Text>
              <Badge variant={user?.gmail_connected ? "default" : "secondary"}>
                <Text>{user?.gmail_connected ? "Connected" : "Not connected"}</Text>
              </Badge>
            </View>
            <Text className="mt-1 text-[13px] text-muted-foreground">Import transactions from bank alert emails.</Text>
          </View>
          {user?.gmail_connected ? (
            <Button variant="outline" size="sm" loading={isSyncing} onPress={() => syncGmail()}>
              <Text>Sync now</Text>
            </Button>
          ) : (
            <Button size="sm" loading={isConnecting} onPress={handleConnectGmail}>
              <Text>Connect</Text>
            </Button>
          )}
        </View>
        {user?.gmail_connected && (
          <View className="border-t border-border px-4 py-2">
            <Button variant="ghost" size="sm" className="self-start px-0" loading={isDisconnecting} onPress={handleDisconnectGmail}>
              <Text className="text-destructive">Disconnect Gmail</Text>
            </Button>
          </View>
        )}
        {Platform.OS === "android" && (
          <View className="flex-row items-center gap-3 border-t border-border p-4">
            <View className="flex-1">
              <Text className="text-sm font-medium">SMS</Text>
              <Text className="mt-1 text-[13px] text-muted-foreground">Import transactions from bank SMS on this phone.</Text>
            </View>
            <Button variant="outline" size="sm" loading={isSyncingSms} onPress={() => syncSms()}>
              <Text>Sync now</Text>
            </Button>
          </View>
        )}
      </Card>
    </View>
  )

  const data = (
    <View>
      <SectionTitle title="Data" />
      <Card className="overflow-hidden">
        <LinkRow label="Cards" icon="card-outline" onPress={() => router.push("/(modals)/accounts")} />
        <LinkRow label="Import bank statement" icon="document-text-outline" onPress={() => router.push("/(modals)/import-statement")} />
        <LinkRow label="Categories" icon="pricetags-outline" onPress={() => router.push("/(modals)/categories")} />
        <LinkRow label="Export transactions (CSV)" icon="download-outline" onPress={() => router.push("/(modals)/export")} last />
      </Card>
    </View>
  )

  const session = (
    <View>
      <SectionTitle title="Session" />
      <Card className="overflow-hidden">
        <LinkRow label="Sign out" icon="log-out-outline" onPress={handleSignOut} />
        <LinkRow label="Delete account" icon="trash-outline" onPress={() => router.push("/(modals)/delete-account")} destructive last />
      </Card>
    </View>
  )

  return (
    <Page>
      <PageHeader title="Settings" description="Your account and preferences." />
      {isDesktop ? (
        <View className="flex-row items-start gap-8">
          <View className="flex-1 gap-6">
            {account}
            {connections}
          </View>
          <View className="w-[360px] gap-6">
            {appearance}
            {data}
            {session}
          </View>
        </View>
      ) : (
        <View className="gap-6">
          {account}
          {appearance}
          {connections}
          {data}
          {session}
        </View>
      )}
    </Page>
  )
}
