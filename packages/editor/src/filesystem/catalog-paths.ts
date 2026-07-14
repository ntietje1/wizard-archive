import type { SidebarItemId } from '../../../../shared/common/ids'
import {
  getMinDisambiguationPath,
  parseResolvableWikiItemPath,
  resolveParsedItemPath,
} from '../../../../shared/links/resolution'
import type { LinkPathKind } from '../../../../shared/links/types'
import { canonicalizeResourceItemTitle } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import type { NoteItem } from '../notes/item-contract'
import type { FileSystemCatalogIndex } from './catalog-index'

interface FileSystemItemPathInput {
  pathKind: LinkPathKind
  pathSegments: Array<string>
  sourceItemId?: SidebarItemId
}

interface FileSystemNotePathInput {
  text: string | null
  sourceItemId?: SidebarItemId
}

export interface FileSystemPaths {
  getVisibleItemLinkPath: (item: AnyItem) => ReadonlyArray<string>
  resolveVisibleFolderPath: (input: FileSystemItemPathInput) => SidebarItemId | null | undefined
  resolveVisibleNotePath: (input: FileSystemNotePathInput) => NoteItem | null
  resolveVisibleItemPath: (input: FileSystemItemPathInput) => AnyItem | null
}

export function createFileSystemPaths(index: FileSystemCatalogIndex): FileSystemPaths {
  return {
    getVisibleItemLinkPath: (item) => getCatalogItemLinkPath(item, index),
    resolveVisibleFolderPath: (input) => resolveCatalogFolderPath(input, index),
    resolveVisibleNotePath: (input) => resolveCatalogNotePath(input, index),
    resolveVisibleItemPath: (input) => resolveCatalogItemPath(input, index),
  }
}

function getCatalogItemLinkPath(item: AnyItem, index: FileSystemCatalogIndex) {
  return getMinDisambiguationPath(item, index.visibleItems, index.visibleItemsById)
}

function resolveCatalogItemPath(
  { pathKind, pathSegments, sourceItemId }: FileSystemItemPathInput,
  index: FileSystemCatalogIndex,
) {
  const sourceParentId = getRelativePathStartParentId(sourceItemId, index)
  return (
    resolveParsedItemPath(
      pathKind,
      pathSegments,
      index.visibleItems,
      index.visibleItemsById,
      sourceParentId,
    ) ?? null
  )
}

/**
 * Returns a folder id for a resolved folder, null for resolved root, or undefined when unresolved.
 */
function resolveCatalogFolderPath(
  { pathKind, pathSegments, sourceItemId }: FileSystemItemPathInput,
  index: FileSystemCatalogIndex,
) {
  const sourceParentId = getRelativePathStartParentId(sourceItemId, index)

  if (pathSegments.length === 0) {
    return pathKind === 'relative' ? sourceParentId : null
  }

  if (pathKind === 'global') {
    const folder = resolveParsedItemPath(
      'global',
      pathSegments,
      index.visibleItems,
      index.visibleItemsById,
    )
    return folder?.type === RESOURCE_TYPES.folders ? folder.id : undefined
  }

  if (sourceParentId === undefined) return undefined

  let currentParentId = sourceParentId
  for (const segment of pathSegments) {
    const nextParentId = resolveVisibleFolderSegment(
      segment,
      currentParentId,
      index.visibleChildrenByParent,
      index.visibleItemsById,
    )
    if (nextParentId === undefined) return undefined
    currentParentId = nextParentId
  }

  return currentParentId
}

function getRelativePathStartParentId(
  sourceItemId: SidebarItemId | undefined,
  index: FileSystemCatalogIndex,
) {
  if (!sourceItemId) return undefined
  const sourceItem = index.visibleItemsById.get(sourceItemId)
  if (!sourceItem) return undefined
  return sourceItem.type === RESOURCE_TYPES.folders ? sourceItem.id : sourceItem.parentId
}

function resolveCatalogNotePath(
  { text, sourceItemId }: FileSystemNotePathInput,
  index: FileSystemCatalogIndex,
) {
  if (!text) return null
  const parsed = parseResolvableWikiItemPath(text)
  if (!parsed) return null
  const item = resolveCatalogItemPath(
    {
      pathKind: parsed.pathKind,
      pathSegments: parsed.itemPath,
      sourceItemId,
    },
    index,
  )
  return item?.type === RESOURCE_TYPES.notes ? item : null
}

function resolveVisibleFolderSegment(
  segment: string,
  currentParentId: SidebarItemId | null,
  childrenByParent: ReadonlyMap<SidebarItemId | null, ReadonlyArray<AnyItem>>,
  itemsById: ReadonlyMap<SidebarItemId, AnyItem>,
) {
  const title = canonicalizeResourceItemTitle(segment)
  if (title === '.') return currentParentId
  if (title === '..') {
    return currentParentId === null ? undefined : itemsById.get(currentParentId)?.parentId
  }

  return childrenByParent.get(currentParentId)?.find((item) => {
    return (
      item.type === RESOURCE_TYPES.folders && canonicalizeResourceItemTitle(item.name) === title
    )
  })?.id
}
