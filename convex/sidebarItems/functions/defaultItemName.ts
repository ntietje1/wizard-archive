import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'

export const defaultNameMap: Record<SidebarItemType, string> = {
  [SIDEBAR_ITEM_TYPES.folders]: 'Untitled Folder',
  [SIDEBAR_ITEM_TYPES.notes]: 'Untitled Note',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'Untitled Map',
  [SIDEBAR_ITEM_TYPES.files]: 'Untitled File',
}

/**
 * Returns a unique default name like "Untitled Note", "Untitled Note 2", etc.
 * Case-insensitive comparison against existing siblings.
 */
export function findUniqueDefaultName(
  type: SidebarItemType,
  siblings: Array<{ name: string }>,
): string {
  const base = defaultNameMap[type]
  if (!siblings.some((s) => s.name.toLowerCase() === base.toLowerCase())) {
    return base
  }
  for (let i = 2; i <= 1000; i++) {
    const candidate = `${base} ${i}`
    if (
      !siblings.some((s) => s.name.toLowerCase() === candidate.toLowerCase())
    ) {
      return candidate
    }
  }
  return `${base} ${Date.now()}`
}
