import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'

export const defaultNameMap: Record<SidebarItemType, string> = {
  [SIDEBAR_ITEM_TYPES.folders]: 'Untitled Folder',
  [SIDEBAR_ITEM_TYPES.notes]: 'Untitled Note',
  [SIDEBAR_ITEM_TYPES.gameMaps]: 'Untitled Map',
  [SIDEBAR_ITEM_TYPES.files]: 'Untitled File',
  [SIDEBAR_ITEM_TYPES.canvases]: 'Untitled Canvas',
}

/**
 * Given a base name and a list of sibling names, returns a unique name
 * by appending " 2", " 3", etc. if needed. Case-insensitive.
 */
export function deduplicateName(base: string, siblingNames: Array<string>): string {
  const lowerNames = new Set(siblingNames.map((n) => n.toLowerCase()))
  if (!lowerNames.has(base.toLowerCase())) {
    return base
  }
  for (let i = 2; i <= 1000; i++) {
    const candidate = `${base} ${i}`
    if (!lowerNames.has(candidate.toLowerCase())) {
      return candidate
    }
  }
  return `${base} ${Date.now()}`
}

/**
 * Returns a unique default name like "Untitled Note", "Untitled Note 2", etc.
 * Case-insensitive comparison against existing siblings.
 */
export function findUniqueDefaultName(
  type: SidebarItemType,
  siblings: Array<{ name: string }>,
): string {
  return deduplicateName(
    defaultNameMap[type],
    siblings.map((s) => s.name),
  )
}
