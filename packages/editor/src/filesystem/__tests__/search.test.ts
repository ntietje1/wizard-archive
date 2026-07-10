import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import {
  createCatalogFileSystemSearch,
  createCatalogItemSearchResult,
  createResourceCatalogModel,
} from '../catalog'
import { createCatalogItemLink } from '../catalog-links'
import { createStaticCatalogFileSystemSearch } from '../search'
import { createStaticCatalogFileSystemResourceContentSource } from '../resource-content-source'
import type { ResourceContentSource } from '../resource-content-source'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
import type { BlockSearchResult } from '../../../../../shared/search/types'
import type { InlineContent, NoteBlock, TableContent } from '../../notes/document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'

describe('filesystem search', () => {
  it('projects catalog items, body matches, breadcrumbs, and recent items into search state', () => {
    const folder = createFolder({ name: 'Bestiary' })
    const titleMatch = createNote({ name: 'Ancient Dragon', parentId: folder.id })
    const bodyMatch = createNote({ name: 'Volcanic Lair', parentId: folder.id })
    const hiddenBodyMatch = createNote({ name: 'Hidden Lair', parentId: folder.id })
    const recent = createNote({ name: 'Recent Scene', parentId: folder.id })
    const { catalog } = createResourceCatalogModel({
      activeItems: [folder, titleMatch, bodyMatch, hiddenBodyMatch, recent],
      visibleActiveItems: [folder, titleMatch, bodyMatch, recent],
      trashItems: [],
    })
    const bodyResults: Array<BlockSearchResult> = [
      {
        noteId: bodyMatch.id,
        blockNoteId: 'body-match' as BlockSearchResult['blockNoteId'],
        plainText: 'Dragon tracks lead through the ash.',
        type: 'paragraph',
      },
      {
        noteId: hiddenBodyMatch.id,
        blockNoteId: 'hidden-match' as BlockSearchResult['blockNoteId'],
        plainText: 'Hidden result is not in the visible catalog.',
        type: 'paragraph',
      },
    ]

    const search = createCatalogFileSystemSearch({
      catalog,
      ensureSearchState: () => undefined,
      getSearchBodyState: () => ({
        bodyResults,
        bodySearchError: null,
        bodySearchPending: false,
      }),
      itemLinks: { status: 'unsupported', reason: 'not_implemented' },
      recentItems: [createCatalogItemSearchResult(catalog, recent)],
    })
    const searchState = search.getSearchState({ query: 'dragon' })

    expect(searchState).toMatchObject({
      bodySearchError: null,
      bodySearchPending: false,
      recentItems: [
        {
          itemId: recent.id,
          breadcrumb: 'Bestiary/',
          matchType: 'title',
          matchText: null,
        },
      ],
      results: [
        {
          itemId: titleMatch.id,
          breadcrumb: 'Bestiary/',
          matchType: 'title',
          matchText: null,
        },
        {
          itemId: bodyMatch.id,
          breadcrumb: 'Bestiary/',
          matchType: 'body',
          matchText: 'Dragon tracks lead through the ash.',
        },
      ],
    })
  })
})

describe('filesystem search hydration', () => {
  it('keeps React hydration and static adapter wiring outside the pure catalog module', () => {
    const catalogSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/filesystem/catalog.ts'),
      'utf8',
    )
    const resourceContentSource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/filesystem/resource-content-source.ts'),
      'utf8',
    )
    const testRuntimeFactorySource = readFileSync(
      path.join(process.cwd(), 'packages/editor/src/test/workspace-runtime-factory.ts'),
      'utf8',
    )

    expect(catalogSource).not.toContain("from 'react'")
    expect(catalogSource).not.toMatch(/\buse(Effect|Ref|State)\b/)
    expect(catalogSource).not.toContain('useResourceHydrationCache')
    expect(catalogSource).not.toContain('./catalog-static-search')
    expect(catalogSource).not.toContain('getStaticCatalogBodySearchResults')
    expect(catalogSource).not.toContain('createStaticCatalogItemLinksCapability')
    expect(catalogSource).not.toContain('createStaticCatalogItemContentState')
    expect(catalogSource).not.toContain('createItemPreviewState')
    expect(catalogSource).not.toContain('getItemPreviewState')
    expect(catalogSource).not.toContain('createCatalogFileSystemResourcePreview')
    expect(resourceContentSource).not.toMatch(/\bItemPreviewState\b(?!:)/)
    expect(resourceContentSource).not.toContain('getItemPreviewState')
    expect(resourceContentSource).not.toContain('useHydratedCatalogFileSystemResourcePreview')
    expect(resourceContentSource).not.toContain('createStaticCatalogFileSystemResourcePreview')
    expect(testRuntimeFactorySource).not.toContain('createStaticCatalogFileSystemResourcePreview')
    expect(testRuntimeFactorySource).not.toContain(
      'createFileSystemResourcePreviewFromResourceContent',
    )
    expect(
      readFileSync(
        path.join(process.cwd(), 'packages/editor/src/filesystem/filesystem.ts'),
        'utf8',
      ),
    ).not.toContain('resourcePreview')
  })

  it('projects static catalog item content into the shared content state contract', () => {
    const note = {
      ...createNote({ id: 'note-1' as SidebarItemId }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [],
    } satisfies AnyItemWithContent
    const resourceContent = createStaticContentSource([note])

    expect(resourceContent.getContentState(note.id)).toEqual({
      status: 'ready',
      label: note.name,
      item: note,
      folderChildren: [],
      isLoading: false,
      error: null,
    })
    expect(resourceContent.getContentState(null, 'Page')).toEqual({
      status: 'idle',
      label: 'Page',
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
    })
  })

  it('maps source link rows into editor item links', () => {
    expect(
      createCatalogItemLink({
        id: 'link-1',
        query: '[[Lore]]',
        displayName: 'Lore',
        item: { id: 'note-1' as SidebarItemId, name: 'Lore note' },
      }),
    ).toEqual({
      id: 'link-1',
      query: '[[Lore]]',
      displayName: 'Lore',
      item: { id: 'note-1', name: 'Lore note' },
    })
  })
})

describe('static catalog filesystem search', () => {
  it('creates static catalog search state without hydration services', () => {
    const note = createContentNote({
      id: sidebarItemId('note-market'),
      name: 'The Lantern Market',
      content: [paragraph('market-links', 'Ask [[Mara Vell|Mara]] about the shipment.')],
    })
    const targetNote = createContentNote({
      id: sidebarItemId('note-mara'),
      name: 'Mara Vell',
    })
    const search = createStaticSearch([note, targetNote])
    const resourceContent = createStaticContentSource([note, targetNote])

    search.ensureSearchState({ query: 'market' })
    resourceContent.ensureContentState(note.id)

    expect(search.getSearchState({ query: 'market' })).toMatchObject({
      bodySearchError: null,
      bodySearchPending: false,
      results: [{ itemId: note.id, matchType: 'title' }],
    })
    expect(resourceContent.getContentState(note.id)).toMatchObject({
      status: 'ready',
      item: {
        id: note.id,
        name: 'The Lantern Market',
      },
    })
    expect(search.itemLinks).toMatchObject({ status: 'available' })
    const outgoingLinks =
      search.itemLinks.status === 'available'
        ? search.itemLinks.getItemLinks({ itemId: note.id, kind: 'outgoing' })
        : null

    expect(outgoingLinks).toMatchObject({
      status: 'success',
      links: [
        expect.objectContaining({
          query: 'Mara Vell',
          item: { id: targetNote.id, name: 'Mara Vell' },
        }),
      ],
    })
  })

  it('finds visible note body text through the shared search result model', () => {
    const titleMatch = createContentNote({
      id: sidebarItemId('note-title'),
      name: 'Glass Ledger',
      content: [paragraph('title-body', 'Title matches should stay title-ranked.')],
    })
    const bodyMatch = createContentNote({
      id: sidebarItemId('note-body'),
      name: 'Dockside Rumors',
      content: [
        paragraph('body-match', 'A blue glass shipment waits under the eastern pier.'),
        table('body-table', 'The quartermaster repeats the blue glass phrase.'),
      ],
    })
    const otherNote = createContentNote({
      id: sidebarItemId('note-other'),
      name: 'Warehouse Manifest',
      content: [paragraph('other-body', 'No matching cargo is listed here.')],
    })
    const search = createStaticSearch([titleMatch, bodyMatch, otherNote])

    expect(search.getSearchState({ query: 'glass' })).toMatchObject({
      bodySearchError: null,
      bodySearchPending: false,
      results: [
        { itemId: titleMatch.id, matchType: 'title', matchText: null },
        {
          itemId: bodyMatch.id,
          matchType: 'body',
          matchText: 'A blue glass shipment waits under the eastern pier.',
        },
      ],
    })
  })

  it('omits hidden note blocks from static body search and links', () => {
    const sourceNote = createContentNote({
      id: sidebarItemId('note-source'),
      name: 'Source Note',
      content: [
        paragraph('visible-body', 'Visible glass clue points at [[Visible Target]].'),
        paragraph('hidden-body', 'Hidden glass clue points at [[Hidden Target]].'),
      ],
      blockMeta: {
        'visible-body': visibleBlockMeta(),
        'hidden-body': hiddenBlockMeta(),
      },
    })
    const visibleTarget = createContentNote({
      id: sidebarItemId('note-visible-target'),
      name: 'Visible Target',
    })
    const hiddenTarget = createContentNote({
      id: sidebarItemId('note-hidden-target'),
      name: 'Hidden Target',
    })
    const search = createStaticSearch([sourceNote, visibleTarget, hiddenTarget])

    expect(search.getSearchState({ query: 'glass' }).results).toEqual([
      expect.objectContaining({
        itemId: sourceNote.id,
        matchText: 'Visible glass clue points at [[Visible Target]].',
      }),
    ])
    expect(
      search.itemLinks.status === 'available'
        ? requireSuccessLinks(
            search.itemLinks.getItemLinks({ itemId: sourceNote.id, kind: 'outgoing' }),
          )
        : [],
    ).toEqual([
      expect.objectContaining({
        query: 'Visible Target',
        item: { id: visibleTarget.id, name: 'Visible Target' },
      }),
    ])
    expect(
      search.itemLinks.status === 'available'
        ? requireSuccessLinks(
            search.itemLinks.getItemLinks({ itemId: hiddenTarget.id, kind: 'backlinks' }),
          )
        : [],
    ).toEqual([])
  })

  it('derives outgoing internal links from visible note content', () => {
    const sourceNote = createContentNote({
      id: sidebarItemId('note-market'),
      name: 'The Lantern Market',
      content: [
        paragraph(
          'market-links',
          'Ask [[Mara Vell|Mara]] about the shipment. [Missing clue](Missing Note#Lore) remains unresolved. [External dossier](https://example.com/dossier) is external.',
        ),
      ],
    })
    const targetNote = createContentNote({
      id: sidebarItemId('note-mara'),
      name: 'Mara Vell',
    })
    const itemLinks = createStaticSearch([sourceNote, targetNote]).itemLinks

    expect(
      itemLinks.status === 'available'
        ? itemLinks.getItemLinks({ itemId: sourceNote.id, kind: 'outgoing' })
        : null,
    ).toEqual({
      status: 'success',
      links: [
        expect.objectContaining({
          query: 'Mara Vell',
          displayName: 'Mara',
          item: { id: targetNote.id, name: 'Mara Vell' },
        }),
        expect.objectContaining({
          query: 'Missing Note#Lore',
          displayName: 'Missing clue',
          item: null,
        }),
      ],
    })
  })

  it('derives backlinks from note content that resolves to the target item', () => {
    const targetNote = createContentNote({
      id: sidebarItemId('note-mara'),
      name: 'Mara Vell',
    })
    const sourceNote = createContentNote({
      id: sidebarItemId('note-market'),
      name: 'The Lantern Market',
      content: [paragraph('market-links', 'Ask [[Mara Vell|Mara]] about the shipment.')],
    })
    const itemLinks = createStaticSearch([sourceNote, targetNote]).itemLinks

    expect(
      itemLinks.status === 'available'
        ? itemLinks.getItemLinks({ itemId: targetNote.id, kind: 'backlinks' })
        : null,
    ).toEqual({
      status: 'success',
      links: [
        expect.objectContaining({
          query: 'Mara Vell',
          displayName: 'Mara',
          item: { id: sourceNote.id, name: 'The Lantern Market' },
        }),
      ],
    })
  })

  it('resolves folder-qualified static links through the full parsed item path', () => {
    const folder = createFolder({ name: 'Lore' })
    const sourceNote = createContentNote({
      id: sidebarItemId('note-market'),
      name: 'The Lantern Market',
      content: [paragraph('market-links', 'Ask [[Lore/Mara Vell|Mara]] about the shipment.')],
    })
    const targetNote = createContentNote({
      id: sidebarItemId('note-mara'),
      name: 'Mara Vell',
      parentId: folder.id,
    })
    const itemLinks = createStaticSearch([folder, sourceNote, targetNote]).itemLinks

    expect(
      itemLinks.status === 'available'
        ? itemLinks.getItemLinks({ itemId: targetNote.id, kind: 'backlinks' })
        : null,
    ).toEqual({
      status: 'success',
      links: [
        expect.objectContaining({
          query: 'Lore/Mara Vell',
          displayName: 'Mara',
          item: { id: sourceNote.id, name: 'The Lantern Market' },
        }),
      ],
    })
  })

  it('finds links inside nested blocks and table cells', () => {
    const sourceNote = createContentNote({
      id: sidebarItemId('note-source'),
      name: 'Source Note',
      content: [
        {
          ...paragraph('parent', 'Parent'),
          children: [paragraph('child', 'Nested [[Nested Target]]')],
        },
        table('table', 'Table cell references [[Table Target]]'),
      ],
    })
    const nestedTarget = createContentNote({
      id: sidebarItemId('note-nested'),
      name: 'Nested Target',
    })
    const tableTarget = createContentNote({
      id: sidebarItemId('note-table'),
      name: 'Table Target',
    })
    const itemLinks = createStaticSearch([sourceNote, nestedTarget, tableTarget]).itemLinks

    expect(
      itemLinks.status === 'available'
        ? itemLinks.getItemLinks({ itemId: sourceNote.id, kind: 'outgoing' })
        : null,
    ).toEqual({
      status: 'success',
      links: [
        expect.objectContaining({
          query: 'Nested Target',
          item: { id: nestedTarget.id, name: 'Nested Target' },
        }),
        expect.objectContaining({
          query: 'Table Target',
          item: { id: tableTarget.id, name: 'Table Target' },
        }),
      ],
    })
  })

  it('ignores visible note metadata without hydrated content', () => {
    const metadataOnlyNote = createNote({
      id: sidebarItemId('metadata-only-note'),
      name: 'Metadata Only',
    })
    const search = createStaticSearch([metadataOnlyNote])
    const resourceContent = createStaticContentSource([metadataOnlyNote])

    expect(search.getSearchState({ query: 'metadata' })).toMatchObject({
      bodySearchError: null,
      bodySearchPending: false,
      results: [{ itemId: metadataOnlyNote.id, matchType: 'title', matchText: null }],
    })
    expect(resourceContent.getContentState(metadataOnlyNote.id)).toEqual({
      status: 'not_found',
      label: 'Metadata Only',
      item: undefined,
      folderChildren: [],
      error: null,
      isLoading: false,
    })
  })
})

function createStaticSearch(items: Array<AnyItem>) {
  const { catalog, paths } = createResourceCatalogModel({
    activeItems: items,
    trashItems: [],
    visibleActiveItems: items,
  })
  return createStaticCatalogFileSystemSearch({
    catalog,
    createSearch: createCatalogFileSystemSearch,
    createSearchResult: createCatalogItemSearchResult,
    currentContentItem: null,
    paths,
  })
}

function createStaticContentSource(
  items: Array<AnyItem>,
): Extract<ResourceContentSource, { status: 'available' }> {
  const { catalog } = createResourceCatalogModel({
    activeItems: items,
    trashItems: [],
    visibleActiveItems: items,
  })
  const resourceContent = createStaticCatalogFileSystemResourceContentSource({
    catalog,
    current: {
      item: null,
      contentItem: null,
      availabilityState: {
        status: 'not_found',
        label: 'Page',
        message: 'Page not found.',
      },
    },
  })
  if (resourceContent.status !== 'available') {
    throw new Error('Expected static test resource content to be available')
  }
  return resourceContent
}

function createContentNote({
  content = [],
  blockMeta,
  ...overrides
}: Parameters<typeof createNote>[0] & {
  blockMeta?: NoteItemWithContent['blockMeta']
  content?: Array<NoteBlock>
} = {}): NoteItemWithContent {
  return {
    ...createNote(overrides),
    ancestors: [],
    content,
    blockMeta:
      blockMeta ??
      Object.fromEntries(flattenTestBlocks(content).map((block) => [block.id, visibleBlockMeta()])),
    blockShareAccessWarnings: [],
  }
}

function visibleBlockMeta() {
  return {
    myPermissionLevel: PERMISSION_LEVEL.VIEW,
    shareStatus: SHARE_STATUS.NOT_SHARED,
    sharedWith: [],
  }
}

function hiddenBlockMeta() {
  return {
    myPermissionLevel: PERMISSION_LEVEL.NONE,
    shareStatus: SHARE_STATUS.NOT_SHARED,
    sharedWith: [],
  }
}

function paragraph(id: string, text: string): NoteBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }] satisfies InlineContent,
    children: [],
  } as NoteBlock
}

function table(id: string, text: string): NoteBlock {
  const content = {
    type: 'tableContent',
    columnWidths: [null],
    rows: [
      {
        cells: [
          {
            type: 'tableCell',
            content: [{ type: 'text', text, styles: {} }] satisfies InlineContent,
          },
        ],
      },
    ],
  } satisfies TableContent

  return {
    id,
    type: 'table',
    props: {},
    content,
    children: [],
  } satisfies NoteBlock
}

function flattenTestBlocks(blocks: Array<NoteBlock>): Array<NoteBlock> {
  const flattened: Array<NoteBlock> = []
  const visit = (block: NoteBlock) => {
    flattened.push(block)
    for (const child of block.children ?? []) visit(child)
  }
  for (const block of blocks) visit(block)
  return flattened
}

function requireSuccessLinks(
  state: ReturnType<
    Extract<
      ReturnType<typeof createStaticSearch>['itemLinks'],
      { status: 'available' }
    >['getItemLinks']
  >,
) {
  if (state.status !== 'success') {
    throw new Error(`Expected successful item links, received ${state.status}`)
  }
  return state.links
}

function sidebarItemId(value: string) {
  return value as SidebarItemId
}
