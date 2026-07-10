import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { CampaignMemberId, SidebarItemId } from '../../../../../shared/common/ids'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import {
  createStaticCatalogFileSystemResourceContentSource,
  useHydratedCatalogFileSystemResourceContentSource,
} from '../resource-content-source'
import { createResourceCatalogModel } from '../catalog'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { InlineContent, NoteBlock } from '../../notes/document/model'
import type { NoteItemWithContent } from '../../notes/item-contract'
import type { AnyItemWithContent } from '../../workspace/items'

describe('resource content source', () => {
  it('reuses the current content item without loading it', () => {
    const note = createContentNote({ id: sidebarItemId('note-current'), name: 'Current note' })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [note],
      trashItems: [],
    })
    const loadItemContent = vi.fn()
    const { result } = renderHook(() =>
      useHydratedCatalogFileSystemResourceContentSource({
        catalog,
        current: availableCurrent(note),
        loadItemContent,
        sourceId: 'source-1',
      }),
    )

    if (result.current.status !== 'available') {
      throw new Error('Expected resource content source to be available')
    }
    result.current.ensureContentState(note.id)
    const state = result.current.getContentState(note.id)

    expect(loadItemContent).not.toHaveBeenCalled()
    expect(state).toMatchObject({
      status: 'ready',
      label: 'Current note',
      item: note,
      folderChildren: [],
    })
  })

  it('includes visible folder children in ready folder content', () => {
    const folder = createContentFolder({ id: sidebarItemId('folder-root'), name: 'Root folder' })
    const visibleChild = createNote({ id: sidebarItemId('note-visible'), parentId: folder.id })
    const hiddenChild = createNote({ id: sidebarItemId('note-hidden'), parentId: folder.id })
    const { catalog } = createResourceCatalogModel({
      activeItems: [folder, visibleChild, hiddenChild],
      visibleActiveItems: [folder, visibleChild],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
    })

    expect(source.getContentState(folder.id)).toMatchObject({
      status: 'ready',
      item: folder,
      folderChildren: [visibleChild],
    })
  })

  it('preserves explicit unavailable availability states', () => {
    const note = createNote({ id: sidebarItemId('note-private'), name: 'Private note' })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: {
        item: note,
        contentItem: null,
        availabilityState: {
          status: 'not_shared',
          label: 'Private note',
          message: "This page isn't shared with Player.",
        },
      },
    })

    expect(source.getContentState(note.id)).toEqual({
      status: 'unavailable',
      label: 'Private note',
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
      availabilityState: {
        status: 'not_shared',
        label: 'Private note',
        message: "This page isn't shared with Player.",
      },
    })
  })

  it('returns visible static catalog content', () => {
    const note = createContentNote({ id: sidebarItemId('note-static'), name: 'Static note' })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [note],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
    })

    expect(source.getContentState(note.id)).toMatchObject({
      status: 'ready',
      label: 'Static note',
      item: note,
    })
  })

  it('returns unavailable for known static catalog content that is not visible', () => {
    const note = createContentNote({ id: sidebarItemId('note-known'), name: 'Known note' })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
    })

    expect(source.getContentState(note.id)).toMatchObject({
      status: 'unavailable',
      label: 'Known note',
      item: undefined,
      availabilityState: { status: 'not_shared' },
    })
  })

  it('returns unavailable for trashed static catalog content', () => {
    const note = createContentNote({
      id: sidebarItemId('note-trashed'),
      name: 'Trashed note',
      status: 'trashed',
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [],
      visibleActiveItems: [],
      trashItems: [note],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
    })

    expect(source.getContentState(note.id)).toMatchObject({
      status: 'unavailable',
      label: 'Trashed note',
      item: undefined,
      availabilityState: { status: 'trashed' },
    })
  })

  it('does not hydrate catalog resources that are not visible', () => {
    const note = createNote({ id: sidebarItemId('note-private-hydration') })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [],
      trashItems: [],
    })
    const loadItemContent = vi.fn()
    const { result } = renderHook(() =>
      useHydratedCatalogFileSystemResourceContentSource({
        catalog,
        current: availableCurrent(null),
        loadItemContent,
        sourceId: 'source-private',
      }),
    )

    if (result.current.status !== 'available') {
      throw new Error('Expected resource content source to be available')
    }
    result.current.ensureContentState(note.id)

    expect(loadItemContent).not.toHaveBeenCalled()
    expect(result.current.getContentState(note.id)).toMatchObject({
      status: 'unavailable',
      item: undefined,
      availabilityState: { status: 'not_shared' },
    })
  })

  it('returns loading before hydrated content resolves and ready after it resolves', async () => {
    const note = createNote({ id: sidebarItemId('note-hydrated'), name: 'Hydrated note' })
    const loadedNote = createContentNote({
      id: note.id,
      name: 'Hydrated note',
      content: [paragraph('loaded', 'Loaded body')],
    })
    const load = deferred<AnyItemWithContent | null>()
    const loadItemContent = vi.fn(() => load.promise)
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [note],
      trashItems: [],
    })
    const { result } = renderHook(() =>
      useHydratedCatalogFileSystemResourceContentSource({
        catalog,
        current: availableCurrent(null),
        loadItemContent,
        sourceId: 'source-1',
      }),
    )

    act(() => {
      if (result.current.status === 'available') {
        result.current.ensureContentState(note.id)
      }
    })

    expect(loadItemContent).toHaveBeenCalledExactlyOnceWith(note.id)
    expect(
      result.current.status === 'available' ? result.current.getContentState(note.id) : null,
    ).toMatchObject({ status: 'loading', label: 'Hydrated note', isLoading: true })

    load.resolve(loadedNote)
    await act(async () => {
      await load.promise
    })

    expect(
      result.current.status === 'available' ? result.current.getContentState(note.id) : null,
    ).toMatchObject({
      status: 'ready',
      label: 'Hydrated note',
      item: loadedNote,
    })
  })

  it('projects note content through player visibility rules', () => {
    const playerId = 'player-1' as CampaignMemberId
    const visibleBlock = paragraph('visible', 'Visible clue')
    const hiddenBlock = paragraph('hidden', 'Hidden clue')
    const note = createContentNote({
      id: sidebarItemId('note-projected'),
      name: 'Projected note',
      content: [visibleBlock, hiddenBlock],
      blockMeta: {
        visible: visibleBlockMeta(),
        hidden: { ...visibleBlockMeta(), hiddenFrom: [playerId] },
      },
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [note],
      visibleActiveItems: [note],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
      contentProjection: {
        canAccessItem: () => true,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.VIEW,
        viewAsPlayerId: playerId,
      },
    })

    const state = source.getContentState(note.id)
    if (state.status !== 'ready') throw new Error(`Expected ready state, received ${state.status}`)
    const projectedNote = state.item as NoteItemWithContent

    expect(projectedNote.content.map((block) => block.id)).toEqual(['visible'])
  })

  it('returns unavailable before rendering non-note content hidden in view-as mode', () => {
    const playerId = 'player-1' as CampaignMemberId
    const folder = createContentFolder({
      id: sidebarItemId('folder-hidden-view-as'),
      name: 'Hidden folder',
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [folder],
      visibleActiveItems: [folder],
      trashItems: [],
    })
    const source = createStaticCatalogFileSystemResourceContentSource({
      catalog,
      current: availableCurrent(null),
      contentProjection: {
        canAccessItem: () => false,
        getMemberItemPermissionLevel: () => PERMISSION_LEVEL.NONE,
        viewAsPlayerId: playerId,
      },
    })

    expect(source.getContentState(folder.id)).toMatchObject({
      status: 'unavailable',
      item: undefined,
      availabilityState: { status: 'not_shared' },
    })
  })
})

function availableCurrent(item: AnyItemWithContent | null) {
  return {
    item,
    contentItem: item,
    availabilityState: item
      ? { status: 'available' as const, label: item.name, item }
      : { status: 'not_found' as const, label: 'Page', message: "This page doesn't exist." },
  }
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

function createContentFolder(overrides: Parameters<typeof createFolder>[0]) {
  return {
    ...createFolder(overrides),
    ancestors: [],
  } as unknown as AnyItemWithContent
}

function visibleBlockMeta() {
  return {
    myPermissionLevel: PERMISSION_LEVEL.VIEW,
    shareStatus: SHARE_STATUS.ALL_SHARED,
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

function flattenTestBlocks(blocks: Array<NoteBlock>): Array<NoteBlock> {
  const flattened: Array<NoteBlock> = []
  const visit = (block: NoteBlock) => {
    flattened.push(block)
    for (const child of block.children ?? []) visit(child)
  }
  for (const block of blocks) visit(block)
  return flattened
}

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

function sidebarItemId(value: string) {
  return value as SidebarItemId
}
