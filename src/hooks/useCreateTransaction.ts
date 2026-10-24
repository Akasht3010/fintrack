import { useMutation, useQueryClient } from "@tanstack/react-query"
import { transactionApi, TransactionCreatePayload } from "@/api/endpoints/transactions"
import { invalidateTransactionQueries } from "@/api/invalidate"

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TransactionCreatePayload) => transactionApi.create(data),
    onSuccess: () => invalidateTransactionQueries(queryClient)
  })
}
