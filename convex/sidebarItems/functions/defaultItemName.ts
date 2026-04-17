import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'
import { assertSidebarItemName, SIDEBAR_ITEM_NAME_MAX_LENGTH } from '../validation/name'
import type { SidebarItemName } from '../validation/name'

export const defaultNameMap: Record<SidebarItemType, SidebarItemName> = {
  [SIDEBAR_ITEM_TYPES.folders]: assertSidebarItemName('Untitled Folder'),
  [SIDEBAR_ITEM_TYPES.notes]: assertSidebarItemName('Untitled Note'),
  [SIDEBAR_ITEM_TYPES.gameMaps]: assertSidebarItemName('Untitled Map'),
  [SIDEBAR_ITEM_TYPES.files]: assertSidebarItemName('Untitled File'),
  [SIDEBAR_ITEM_TYPES.canvases]: assertSidebarItemName('Untitled Canvas'),
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
    const suffix = ` ${i}`
    const maxBaseLength = SIDEBAR_ITEM_NAME_MAX_LENGTH - suffix.length
    const candidate = `${base.slice(0, maxBaseLength)}${suffix}`
    if (!lowerNames.has(candidate.toLowerCase())) {
      return candidate
    }
  }
  const fallbackSuffix = ` ${Date.now()}`
  const maxBaseLength = SIDEBAR_ITEM_NAME_MAX_LENGTH - fallbackSuffix.length
  return `${base.slice(0, maxBaseLength)}${fallbackSuffix}`
}

/**
 * Returns a unique default name like "Untitled Note", "Untitled Note 2", etc.
 * Case-insensitive comparison against existing siblings.
 */
export function findUniqueDefaultName(
  type: SidebarItemType,
  siblings: Array<{ name: SidebarItemName }>,
): SidebarItemName {
  return assertSidebarItemName(
    deduplicateName(
      defaultNameMap[type],
      siblings.map((s) => s.name),
    ),
  )
}
