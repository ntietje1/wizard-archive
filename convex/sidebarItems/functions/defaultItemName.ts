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

function hasDedupeSequenceEvidence(
  root: string,
  lowerNames: ReadonlySet<string>,
  ignoredLowerName: string,
): boolean {
  const lowerRoot = root.toLowerCase()
  if (lowerRoot !== ignoredLowerName && lowerNames.has(lowerRoot)) return true

  const prefix = `${lowerRoot} `
  for (const name of lowerNames) {
    if (name === ignoredLowerName) continue
    if (name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length))) {
      return true
    }
  }
  return false
}

function dedupeBaseName(
  base: string,
  lowerNames: ReadonlySet<string>,
  ignoredLowerName: string,
): string {
  let result = base
  let candidate = result
  let suffixCount = 0
  while (true) {
    const match = /^(.*) \d+$/.exec(candidate)
    if (!match?.[1]) return result
    candidate = match[1]
    suffixCount += 1
    if (suffixCount > 1 || hasDedupeSequenceEvidence(candidate, lowerNames, ignoredLowerName)) {
      result = candidate
    }
  }
}

/**
 * Given a base name and sibling names, returns a unique name by checking
 * "Base", then "Base 1", "Base 2", etc. Case-insensitive.
 */
export function deduplicateName(base: string, siblingNames: Array<string>): string {
  const normalizedBase = base.trimEnd()
  const lowerNames = new Set(siblingNames.map((n) => n.toLowerCase()))
  const lowerBase = normalizedBase.toLowerCase()
  if (!lowerNames.has(lowerBase)) {
    return normalizedBase
  }
  const dedupeBase = dedupeBaseName(normalizedBase, lowerNames, lowerBase)
  const lowerDedupeBase = dedupeBase.toLowerCase()
  if (lowerDedupeBase !== lowerBase && !lowerNames.has(lowerDedupeBase)) {
    return dedupeBase
  }
  for (let i = 1; i <= lowerNames.size + 1; i++) {
    const suffix = ` ${i}`
    const maxBaseLength = SIDEBAR_ITEM_NAME_MAX_LENGTH - suffix.length
    const candidate = `${dedupeBase.slice(0, maxBaseLength)}${suffix}`
    if (!lowerNames.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  throw new Error('Unable to resolve a unique sidebar item name')
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
