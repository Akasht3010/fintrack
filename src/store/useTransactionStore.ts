import { create } from "zustand"
import { Transaction, MonthlySummary } from "@/types/domain"

interface TransactionState {
  transactions: Transaction[]
  summary: MonthlySummary | null
  isLoading: boolean
  error: string | null
  setTransactions: (transactions: Transaction[]) => void
  addTransaction: (transaction: Transaction) => void
  setSummary: (summary: MonthlySummary) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  summary: null,
  isLoading: false,
  error: null,

  setTransactions: (transactions) => set({ transactions }),

  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [transaction, ...state.transactions]
    })),

  setSummary: (summary) => set({ summary }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error })
}))
