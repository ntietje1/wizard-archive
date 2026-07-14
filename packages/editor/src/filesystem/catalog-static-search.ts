import type { ResourceId } from '../resources/domain-id'
import { extractLinksFromText, getLinkQuery } from '../../../../shared/links/extraction'
import type { ParsedLinkData } from '../../../../shared/links/types'
import type { BlockSearchResult } from '../../../../shared/search/types'
import type { NoteItemWithContent } from '../notes/item-contract'
import type { InlineContent, NoteBlock, TableContent } from '../notes/document/model'
import { canViewNoteBlockInCurrentProjection } from '../notes/visibility'
import type { AnyItem } from '../workspace/items'
import { isResourceItemWithContent } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import { createCatalogItemLink } from './catalog-links'
import type { FileSystemPaths } from './catalog-paths'
import type { ItemLink, ItemLinksCapability } from './search'

export type StaticCatalogFileSystemSearchPaths = Pick<FileSystemPaths, 'resolveVisibleItemPath'>

export interface StaticCatalogSearchCatalog {
  getKnownItemById: (itemId: ResourceId) => AnyItem | null
  getVisibleItemById: (itemId: ResourceId) => AnyItem | null
  queryVisibleItems: (input?: { type?: AnyItem['type'] }) => ReadonlyArray<AnyItem>
}

type AvailableItemLinks = Extract<ItemLinksCapability, { status: 'available' }>
type ItemLinksInput = Parameters<AvailableItemLinks['getItemLinks']>[0]
type ItemLinksState = ReturnType<AvailableItemLinks['getItemLinks']>

export function getStaticCatalogBodySearchResults(
  catalog: StaticCatalogSearchCatalog,
  query: string,
): Array<BlockSearchResult> | undefined {
  const lowerQuery = query.trim().toLowerCase()
  if (!lowerQuery) return undefined

  const results: Array<BlockSearchResult> = []
  for (const note of getVisibleNotes(catalog)) {
    for (const block of flattenVisibleNoteBlocks(note)) {
      const plainText = getBlockPlainText(block)
      if (!plainText.toLowerCase().includes(lowerQuery)) continue
      results.push({
        blockNoteId: block.id,
        noteId: note.id,
        plainText,
        type: block.type,
      })
    }
  }
  return results
}

export function createStaticCatalogItemLinksCapability({
  catalog,
  paths,
}: {
  catalog: StaticCatalogSearchCatalog
  paths: StaticCatalogFileSystemSearchPaths
}): ItemLinksCapability {
  return {
    status: 'available',
    getItemLinks: (input) => getStaticCatalogItemLinks({ catalog, paths, input }),
  }
}

function getStaticCatalogItemLinks({
  catalog,
  paths,
  input,
}: {
  catalog: StaticCatalogSearchCatalog
  paths: StaticCatalogFileSystemSearchPaths
  input: ItemLinksInput
}): ItemLinksState {
  const links =
    input.kind === 'outgoing'
      ? getOutgoingLinks({ catalog, paths, noteId: input.itemId })
      : getBacklinks({ catalog, paths, itemId: input.itemId })
  return { status: 'success', links }
}

function getOutgoingLinks({
  catalog,
  paths,
  noteId,
}: {
  catalog: StaticCatalogSearchCatalog
  paths: StaticCatalogFileSystemSearchPaths
  noteId: ResourceId
}): Array<ItemLink> {
  const note = getVisibleNote(catalog, noteId)
  if (!note) return []

  return getNoteLinks({ paths, sourceNote: note }).map(({ link, query, resolvedItem, rowId }) =>
    createCatalogItemLink({
      id: rowId,
      query,
      displayName: link.displayName,
      item: resolvedItem ? { id: resolvedItem.id, name: resolvedItem.name } : null,
    }),
  )
}

function getBacklinks({
  catalog,
  paths,
  itemId,
}: {
  catalog: StaticCatalogSearchCatalog
  paths: StaticCatalogFileSystemSearchPaths
  itemId: ResourceId
}): Array<ItemLink> {
  const links: Array<ItemLink> = []
  for (const sourceNote of getVisibleNotes(catalog)) {
    for (const row of getNoteLinks({ paths, sourceNote })) {
      if (row.resolvedItem?.id !== itemId) continue
      links.push(
        createCatalogItemLink({
          id: row.rowId,
          query: row.query,
          displayName: row.link.displayName,
          item: { id: sourceNote.id, name: sourceNote.name },
        }),
      )
    }
  }
  return links
}

function getVisibleNote(
  catalog: StaticCatalogSearchCatalog,
  itemId: ResourceId,
): NoteItemWithContent | null {
  const item = catalog.getVisibleItemById(itemId)
  return isNoteWithContent(item) ? item : null
}

function getVisibleNotes(catalog: StaticCatalogSearchCatalog): Array<NoteItemWithContent> {
  return catalog.queryVisibleItems({ type: RESOURCE_TYPES.notes }).filter(isNoteWithContent)
}

function getNoteLinks({
  paths,
  sourceNote,
}: {
  paths: StaticCatalogFileSystemSearchPaths
  sourceNote: NoteItemWithContent
}) {
  const rowsByKey = new Map<
    string,
    {
      link: ParsedLinkData
      query: string
      resolvedItem: AnyItem | null
      rowId: string
    }
  >()

  for (const block of flattenVisibleNoteBlocks(sourceNote)) {
    const text = getBlockPlainText(block)
    for (const link of extractLinksFromText(text)) {
      if (link.isExternal) continue
      const query = getLinkQuery(link)
      const resolvedItem = paths.resolveVisibleItemPath({
        pathKind: link.pathKind,
        pathSegments: link.itemPath,
        sourceItemId: sourceNote.id,
      })
      const rowId = getLinkRowId({
        blockId: block.id,
        query,
        resolvedItemId: resolvedItem?.id ?? null,
        sourceNoteId: sourceNote.id,
      })
      if (!rowsByKey.has(rowId)) {
        rowsByKey.set(rowId, { link, query, resolvedItem, rowId })
      }
    }
  }

  return [...rowsByKey.values()]
}

function getLinkRowId({
  blockId,
  query,
  resolvedItemId,
  sourceNoteId,
}: {
  blockId: string
  query: string
  resolvedItemId: ResourceId | null
  sourceNoteId: ResourceId
}) {
  return JSON.stringify([
    'link',
    resolvedItemId ? 'resolved' : 'unresolved',
    sourceNoteId,
    blockId,
    resolvedItemId,
    query,
  ])
}

function flattenVisibleNoteBlocks(note: NoteItemWithContent): Array<NoteBlock> {
  return flattenBlocks(note.content).filter((block) =>
    canViewNoteBlockInCurrentProjection(note.blockMeta[block.id]),
  )
}

function flattenBlocks(blocks: Array<NoteBlock>): Array<NoteBlock> {
  const flattened: Array<NoteBlock> = []
  const visit = (block: NoteBlock) => {
    flattened.push(block)
    for (const child of block.children ?? []) {
      visit(child)
    }
  }
  for (const block of blocks) visit(block)
  return flattened
}

function getBlockPlainText(block: NoteBlock): string {
  const content = block.content
  if (!content) return ''

  if (Array.isArray(content)) {
    return collectInlineTexts(content)
  }

  if (content.type === 'tableContent') {
    return collectTableTexts(content)
  }

  return ''
}

function collectInlineTexts(content: InlineContent): string {
  return content.map((part) => (part.type === 'text' ? part.text : '')).join('')
}

function collectTableTexts(content: TableContent): string {
  return content.rows
    .flatMap((row) => row.cells)
    .map((cell) => collectInlineTexts(cell.content))
    .join('\n')
}

function isNoteWithContent(item: AnyItem | null | undefined): item is NoteItemWithContent {
  return item?.type === RESOURCE_TYPES.notes && isResourceItemWithContent(item)
}
