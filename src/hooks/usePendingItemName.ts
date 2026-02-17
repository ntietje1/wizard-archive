import { useSidebarUIStore } from '~/stores/sidebarUIStore'

export function usePendingItemName() {
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const setPendingItemName = useSidebarUIStore((s) => s.setPendingItemName)
  return { pendingItemName, setPendingItemName }
}
