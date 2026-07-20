import { useMutation, useQueryClient } from "@tanstack/react-query"
import { transactionApi, TransactionCreatePayload } from "@/api/endpoints/transactions"
import { useUserStore } from "@/store/useUserStore"

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  const { user } = useUserStore()

  return useMutation({
    mutationFn: (data: TransactionCreatePayload) => transactionApi.create(data),
    onSuccess: () => {
      // Invalidate and refetch transactions
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ["transactions", user.id]
        })
      }
    }
  })
}
