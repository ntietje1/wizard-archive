import type { Id } from 'convex/_generated/dataModel'
import { parseWikiLinkText } from 'shared/links/parsing'
import { resolveParsedItemPath } from 'shared/links/resolution'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

export function resolveExternalNoteId(
  notePathRaw: string | null,
  sidebarItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  sourceParentId: Id<'sidebarItems'> | null | undefined,
): Id<'sidebarItems'> | null {
  if (!notePathRaw) {
    return null
  }

  const parsed = parseWikiLinkText(notePathRaw)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }

  const resolvedItem = resolveParsedItemPath(
    parsed.pathKind,
    parsed.itemPath,
    sidebarItems,
    itemsMap,
    sourceParentId,
  )
  return resolvedItem?.type === SIDEBAR_ITEM_TYPES.notes ? resolvedItem._id : null
}
