import { deduplicateNumericSuffix } from './deduplicateNumericSuffix'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemType } from '../types/baseTypes'
import { assertSidebarItemName } from '../validation/name'
import { SIDEBAR_ITEM_NAME_MAX_LENGTH } from '../../../shared/sidebar-items/name'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'

export const defaultNameMap: Record<SidebarItemType, SidebarItemName> = {
  [SIDEBAR_ITEM_TYPES.folders]: assertSidebarItemName('Untitled Folder'),
  [SIDEBAR_ITEM_TYPES.notes]: assertSidebarItemName('Untitled Note'),
  [SIDEBAR_ITEM_TYPES.gameMaps]: assertSidebarItemName('Untitled Map'),
  [SIDEBAR_ITEM_TYPES.files]: assertSidebarItemName('Untitled File'),
  [SIDEBAR_ITEM_TYPES.canvases]: assertSidebarItemName('Untitled Canvas'),
}

/**
 * Given a base name and sibling names, returns a unique name by checking
 * "Base", then "Base 1", "Base 2", etc. Case-insensitive.
 */
export function deduplicateName(base: string, siblingNames: Array<string>): string {
  const normalizedBase = base.trimEnd()
  return deduplicateNumericSuffix(normalizedBase, siblingNames, {
    separator: ' ',
    normalize: (value) => value.toLowerCase(),
    maxLength: SIDEBAR_ITEM_NAME_MAX_LENGTH,
    errorLabel: 'sidebar item name',
  })
}

/**
 * Returns a unique default name like "Untitled Note", "Untitled Note 1", etc.
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
