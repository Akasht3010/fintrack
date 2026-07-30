import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { categoriesApi } from "@/api/endpoints/categories"
import { CATEGORY_ICONS } from "@/constants/categories"
import { Category } from "@/types/domain"

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list()
  })
}

/**
 * Icon lookup by category name. Seeds from the static default map so icons
 * render immediately (and survive a failed fetch), then overlays whatever
 * the backend returns — which also picks up custom categories' icons.
 */
export function useCategoryIcons(): Record<string, string> {
  const { data } = useCategories()

  return useMemo(() => {
    const map = { ...CATEGORY_ICONS }
    data?.forEach(category => {
      map[category.name] = category.icon
    })
    return map
  }, [data])
}
