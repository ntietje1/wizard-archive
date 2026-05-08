import type { Id } from 'convex/_generated/dataModel'
import type { ActiveItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

export function getPasteTargetParentId(
  activeItemSurface: ActiveItemSurface | null,
  fallbackParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  return fallbackParentId ?? activeItemSurface?.parentId ?? null
}
