import { useQuery } from "@tanstack/react-query"
import { accountsApi } from "@/api/endpoints/accounts"
import { Account, NetWorthSummary } from "@/types/domain"

export function useAccounts(includeArchived = false) {
  return useQuery<Account[]>({
    queryKey: ["accounts", { includeArchived }],
    queryFn: ({ signal }) => accountsApi.list(includeArchived, signal)
  })
}

export function useNetWorth() {
  return useQuery<NetWorthSummary>({
    queryKey: ["net-worth"],
    queryFn: ({ signal }) => accountsApi.netWorth(signal)
  })
}
