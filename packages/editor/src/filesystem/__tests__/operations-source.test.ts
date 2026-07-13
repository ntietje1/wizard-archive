import { describe, expect, it, vi } from 'vite-plus/test'
import { assertResourceItemSlug } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { createResourceCatalogModel } from '../catalog'
import { createWorkspaceFileSystemOperations } from '../operation-construction'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../test/sidebar-item-factory'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { ResourceImportContentInitializers } from '../../files/import-contract'
import type { AnyItem } from '../../workspace/items'
import type { ResourceSlug } from '../../workspace/resource-contract'
import type { ResourceCommandResult } from '../transaction-contract'

const contentInitializers: ResourceImportContentInitializers = {
  initializeImportedFile: vi.fn(),
  initializeImportedTextFile: vi.fn(),
}

const unavailablePasteResult = {
  status: 'unavailable',
  reason: 'test_paste_unavailable',
} as const satisfies ResourceCommandResult

type TestWorkspaceFileSystemOperationDriver = Parameters<
  typeof createWorkspaceFileSystemOperations
>[0]['operationDriver']
type TestWorkspaceFileSystemClipboardDriver = {
  copy: (itemIds: Array<SidebarItemId>) => void
  cut: (itemIds: Array<SidebarItemId>) => void
  canUseClipboardOperations: boolean
  cancelClipboard: () => boolean
  canPaste: (targetParentId?: SidebarItemId | null) => boolean
  paste: (
    targetParentId?: SidebarItemId | null,
  ) => ResourceCommandResult | Promise<ResourceCommandResult>
}
type TestWorkspaceFileSystemDropDriver = Parameters<
  typeof createWorkspaceFileSystemOperations
>[0]['dropDriver']
type TestWorkspaceFileSystemTrashDriver = Parameters<
  typeof createWorkspaceFileSystemOperations
>[0]['trashDriver']
type TestWorkspaceFileSystemNavigateToItem = (
  slug: ResourceSlug,
  options?: { heading?: string; replace?: boolean },
) => Promise<unknown> | void

function createOperationDriver(
  overrides: Partial<TestWorkspaceFileSystemOperationDriver> = {},
): TestWorkspaceFileSystemOperationDriver {
  return {
    createItem: vi.fn(),
    renameItem: vi.fn(),
    toggleBookmarks: vi.fn(),
    ...overrides,
  }
}

function createClipboardDriver(
  overrides: Partial<TestWorkspaceFileSystemClipboardDriver> = {},
): TestWorkspaceFileSystemClipboardDriver {
  return {
    copy: vi.fn(),
    cut: vi.fn(),
    canUseClipboardOperations: true,
    cancelClipboard: vi.fn(),
    canPaste: vi.fn(() => false),
    paste: vi.fn(() => unavailablePasteResult),
    ...overrides,
  }
}

function createDropDriver(
  overrides: Partial<TestWorkspaceFileSystemDropDriver> = {},
): TestWorkspaceFileSystemDropDriver {
  return {
    executeDropCommand: vi.fn(),
    ...overrides,
  }
}

function createTrashDriver(
  overrides: Partial<TestWorkspaceFileSystemTrashDriver> = {},
): TestWorkspaceFileSystemTrashDriver {
  return {
    requestTrashItems: vi.fn(),
    restoreItems: vi.fn(),
    confirmEmptyTrash: vi.fn(),
    confirmDeleteForever: vi.fn(),
    ...overrides,
  }
}

describe('filesystem operations source', () => {
  it('deduplicates created item names against the target siblings and records the created slug', async () => {
    const existing = createNote({ name: 'Scene' })
    const created = createNote({ name: 'Scene 1', slug: 'scene-1' })
    const catalog = createResourceCatalogModel({
      activeItems: [existing],
      trashItems: [],
    }).catalog
    const operationDriver = createOperationDriver({
      createItem: vi.fn().mockResolvedValue({ id: created.id, slug: created.slug }),
    })
    const onItemSlugChange = vi.fn()

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      onItemSlugChange,
      operationDriver,
    })

    const response = await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
      name: ' Scene ',
    })

    expect(operationDriver.createItem).toHaveBeenCalledWith({
      itemType: RESOURCE_TYPES.notes,
      name: 'Scene 1',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(response).toEqual({ status: 'completed', id: created.id, slug: created.slug })
    expect(onItemSlugChange).toHaveBeenCalledExactlyOnceWith(created.id, created.slug)
  })

  it('returns an explicit unavailable create result when item creation is disabled', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const operationDriver = createOperationDriver()

    const source = createTestWorkspaceFileSystemOperations({
      canCreateItems: false,
      catalog,
      operationDriver,
    })

    const result = await Promise.resolve(
      source.createItem({
        type: RESOURCE_TYPES.notes,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'Scene',
      }),
    )

    expect(result).toEqual({ status: 'unavailable', reason: 'create_items_unsupported' })
    expect(operationDriver.createItem).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'folder resources',
      input: {
        type: RESOURCE_TYPES.folders,
        parentTarget: { kind: 'direct' as const, parentId: null },
        name: 'Restricted Folder',
      },
    },
    {
      name: 'path-created parent folders',
      input: {
        type: RESOURCE_TYPES.notes,
        parentTarget: {
          kind: 'path' as const,
          baseParentId: null,
          pathSegments: ['Restricted Folder'],
        },
        name: 'Restricted Note',
      },
    },
  ])('requires folder management for $name', async ({ input }) => {
    const catalog = createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog
    const operationDriver = createOperationDriver()
    const source = createTestWorkspaceFileSystemOperations({
      canManageFolders: false,
      catalog,
      operationDriver,
    })

    await expect(Promise.resolve(source.createItem(input))).resolves.toEqual({
      status: 'unavailable',
      reason: 'manage_folders_unsupported',
    })
    expect(operationDriver.createItem).not.toHaveBeenCalled()
  })

  it('allows non-folder creation through an already resolved path without folder management', async () => {
    const parent = createFolder({ name: 'Scenes' })
    const created = createNote({ name: 'Scene', parentId: parent.id })
    const catalog = createResourceCatalogModel({ activeItems: [parent], trashItems: [] }).catalog
    const operationDriver = createOperationDriver({
      createItem: vi.fn(() => ({ id: created.id, slug: created.slug })),
    })
    const source = createTestWorkspaceFileSystemOperations({
      canManageFolders: false,
      catalog,
      operationDriver,
    })

    await expect(
      Promise.resolve(
        source.createItem({
          type: RESOURCE_TYPES.notes,
          parentTarget: { kind: 'path', baseParentId: null, pathSegments: ['Scenes'] },
          name: 'Scene',
        }),
      ),
    ).resolves.toEqual({ status: 'completed', id: created.id, slug: created.slug })
  })

  it('uses type-specific default names for unnamed created items', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    let createdCount = 0
    const createItem = vi.fn(
      (_: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0]) => {
        createdCount += 1
        return {
          id: `created_${createdCount}` as SidebarItemId,
          slug: assertResourceItemSlug(`created-${createdCount}`),
        }
      },
    )
    const operationDriver = createOperationDriver({ createItem })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })
    const cases = [
      [RESOURCE_TYPES.notes, 'Untitled Note'],
      [RESOURCE_TYPES.folders, 'Untitled Folder'],
      [RESOURCE_TYPES.gameMaps, 'Untitled Map'],
      [RESOURCE_TYPES.files, 'Untitled File'],
      [RESOURCE_TYPES.canvases, 'Untitled Canvas'],
    ] as const

    for (const [type] of cases) {
      await source.createItem({
        type,
        parentTarget: { kind: 'direct', parentId: null },
      })
    }

    expect(createItem.mock.calls.map(([input]) => input)).toEqual(
      cases.map(([type, name]) => ({
        itemType: type,
        name,
        parentTarget: { kind: 'direct', parentId: null },
      })),
    )
  })

  it('fills gaps in unnamed item suffixes against the target siblings', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [
        createNote({ name: 'Untitled Note' }),
        createFolder({ name: 'Untitled Note 1' }),
        createGameMap({ name: 'Untitled Note 3' }),
        createFile({ name: 'Reference' }),
      ],
      trashItems: [],
    }).catalog
    const createItem = vi.fn().mockResolvedValue({
      id: 'note_1' as SidebarItemId,
      slug: assertResourceItemSlug('untitled-note-2'),
    })
    const operationDriver = createOperationDriver({ createItem })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(createItem).toHaveBeenCalledWith({
      itemType: RESOURCE_TYPES.notes,
      name: 'Untitled Note 2',
      parentTarget: { kind: 'direct', parentId: null },
    })
  })

  it('allows imports to target a folder created earlier in the same operation', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const operationDriver = createOperationDriver({
      createItem: vi.fn(({ itemType, parentTarget }) => {
        if (itemType === RESOURCE_TYPES.folders) {
          return { id: 'folder_1' as SidebarItemId, slug: assertResourceItemSlug('folder-1') }
        }
        if (parentTarget.kind !== 'direct' || parentTarget.parentId !== 'folder_1') {
          throw new Error('Expected imported file to target the imported folder')
        }
        return { id: 'file_1' as SidebarItemId, slug: assertResourceItemSlug('file-1') }
      }),
    })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    const imported = await source.importDrop({
      files: [],
      rootFolders: [
        {
          name: 'Assets',
          files: [
            {
              file: {
                name: 'portrait.png',
                contentType: 'image/png',
                size: 5,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(5)),
                text: () => Promise.resolve(''),
              },
            },
          ],
          subfolders: [],
        },
      ],
      parentId: null,
    })

    expect(imported).toMatchObject({
      processedFiles: 1,
      processedFolders: 1,
      skippedFiles: 0,
      lastFolderId: 'folder_1',
    })
  })

  it('allows initializers to create children inside a newly created folder before the parent create resolves', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const createdFolder = {
      id: 'folder_1' as SidebarItemId,
      slug: assertResourceItemSlug('folder-1'),
    }
    const createdNote = {
      id: 'note_1' as SidebarItemId,
      slug: assertResourceItemSlug('note-1'),
    }
    let initializedChild: { status: 'completed'; id: SidebarItemId; slug: ResourceSlug } | null =
      null
    const createItem = vi.fn(
      async (
        input: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0],
        initialize?: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[1],
      ) => {
        if (input.itemType === RESOURCE_TYPES.folders) {
          await initialize?.(createdFolder)
          return createdFolder
        }
        if (
          input.parentTarget.kind !== 'direct' ||
          input.parentTarget.parentId !== createdFolder.id
        ) {
          throw new Error('Expected child create to target the initialized folder')
        }
        return createdNote
      },
    )
    const operationDriver = createOperationDriver({ createItem })
    const onItemSlugChange = vi.fn()
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
      onItemSlugChange,
    })

    await source.createItem(
      {
        type: RESOURCE_TYPES.folders,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'Assets',
      },
      async (folder) => {
        const child = await source.createItem({
          type: RESOURCE_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: folder.id },
          name: 'Scene',
        })
        initializedChild = child.status === 'completed' ? child : null
      },
    )

    expect(initializedChild).toEqual({ status: 'completed', ...createdNote })
    expect(onItemSlugChange).toHaveBeenCalledWith(createdFolder.id, createdFolder.slug)
    expect(
      onItemSlugChange.mock.calls.filter(([itemId]) => itemId === createdFolder.id),
    ).toHaveLength(1)
  })

  it('deduplicates children created inside the same new folder before catalog refresh', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const createdFolder = {
      id: 'folder_1' as SidebarItemId,
      slug: assertResourceItemSlug('folder-1'),
    }
    const createdNotes = [
      { id: 'note_1' as SidebarItemId, slug: assertResourceItemSlug('scene') },
      { id: 'note_2' as SidebarItemId, slug: assertResourceItemSlug('scene-1') },
    ]
    let noteIndex = 0
    const createItem = vi.fn(
      async (
        input: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0],
        initialize?: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[1],
      ) => {
        if (input.itemType === RESOURCE_TYPES.folders) {
          await initialize?.(createdFolder)
          return createdFolder
        }
        return createdNotes[noteIndex++]
      },
    )
    const operationDriver = createOperationDriver({ createItem })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    await source.createItem(
      {
        type: RESOURCE_TYPES.folders,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'Assets',
      },
      async (folder, createNestedItem) => {
        await createNestedItem({
          type: RESOURCE_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: folder.id },
          name: 'Scene',
        })
        await source.createItem({
          type: RESOURCE_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: folder.id },
          name: 'Scene',
        })
      },
    )

    expect(createItem).toHaveBeenNthCalledWith(2, {
      itemType: RESOURCE_TYPES.notes,
      name: 'Scene',
      parentTarget: { kind: 'direct', parentId: createdFolder.id },
    })
    expect(createItem).toHaveBeenNthCalledWith(3, {
      itemType: RESOURCE_TYPES.notes,
      name: 'Scene 1',
      parentTarget: { kind: 'direct', parentId: createdFolder.id },
    })
  })

  it('does not reserve names from initialized creates that fail', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const createdNotes = [
      { id: 'note_1' as SidebarItemId, slug: assertResourceItemSlug('scene') },
      { id: 'note_2' as SidebarItemId, slug: assertResourceItemSlug('scene') },
    ]
    let noteIndex = 0
    const createItem = vi.fn(
      async (
        _input: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0],
        initialize?: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[1],
      ) => {
        const created = createdNotes[noteIndex++]
        await initialize?.(created)
        return created
      },
    )
    const operationDriver = createOperationDriver({ createItem })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    const result = await Promise.resolve(
      source.createItem(
        {
          type: RESOURCE_TYPES.notes,
          parentTarget: { kind: 'direct', parentId: null },
          name: 'Scene',
        },
        () => {
          throw new Error('initialize failed')
        },
      ),
    )
    expect(result).toMatchObject({ status: 'failed', reason: 'create_failed' })
    await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: null },
      name: 'Scene',
    })

    expect(createItem.mock.calls.map(([input]) => input.name)).toEqual(['Scene', 'Scene'])
  })

  it('rolls back nested optimistic folders when an initializer fails', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const createdFolder = {
      id: 'folder_1' as SidebarItemId,
      slug: assertResourceItemSlug('folder-1'),
    }
    const createdChildFolder = {
      id: 'folder_child_1' as SidebarItemId,
      slug: assertResourceItemSlug('folder-child-1'),
    }
    const createItem = vi.fn(
      async (
        input: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0],
        initialize?: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[1],
      ) => {
        if (input.name === 'Assets') {
          await initialize?.(createdFolder)
          return createdFolder
        }
        if (input.name === 'Nested') {
          return createdChildFolder
        }
        return { id: 'note_1' as SidebarItemId, slug: assertResourceItemSlug('scene') }
      },
    )
    const operationDriver = createOperationDriver({ createItem })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    const result = await source.createItem(
      {
        type: RESOURCE_TYPES.folders,
        parentTarget: { kind: 'direct', parentId: null },
        name: 'Assets',
      },
      async (folder, createNestedItem) => {
        await createNestedItem({
          type: RESOURCE_TYPES.folders,
          parentTarget: { kind: 'direct', parentId: folder.id },
          name: 'Nested',
        })
        throw new Error('initialize failed')
      },
    )
    const createUnderRolledBackFolder = await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget: { kind: 'direct', parentId: createdChildFolder.id },
      name: 'Scene',
    })

    expect(result).toMatchObject({ status: 'failed', reason: 'create_failed' })
    expect(createUnderRolledBackFolder).toMatchObject({
      status: 'failed',
      reason: 'create_failed',
    })
    expect(createItem.mock.calls.map(([input]) => input.name)).toEqual(['Assets', 'Nested'])
  })

  it('deduplicates unnamed children created in the same path before catalog refresh', async () => {
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const createdNotes = [
      { id: 'note_1' as SidebarItemId, slug: assertResourceItemSlug('untitled-note') },
      { id: 'note_2' as SidebarItemId, slug: assertResourceItemSlug('untitled-note-1') },
    ]
    let noteIndex = 0
    const createItem = vi.fn(
      (_: Parameters<TestWorkspaceFileSystemOperationDriver['createItem']>[0]) => {
        return createdNotes[noteIndex++]
      },
    )
    const operationDriver = createOperationDriver({ createItem })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })
    const parentTarget = {
      kind: 'path' as const,
      baseParentId: null,
      pathSegments: ['Assets'],
    }

    await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget,
    })
    await source.createItem({
      type: RESOURCE_TYPES.notes,
      parentTarget,
    })

    expect(createItem.mock.calls.map(([input]) => input.name)).toEqual([
      'Untitled Note',
      'Untitled Note 1',
    ])
  })

  it('derives folder paste targets from the clicked destination item', async () => {
    const folder = createFolder({ name: 'Scenes' })
    const note = createNote({ name: 'Ambush' })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, note],
      trashItems: [],
    }).catalog
    const paste = vi.fn(() => unavailablePasteResult)
    const clipboardDriver = createClipboardDriver({
      canPaste: () => true,
      paste,
    })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      clipboardDriver,
      operationDriver: createOperationDriver(),
    })
    const target = {
      clickedItem: folder,
    }

    expect(source.canPasteIntoTarget(target)).toBe(true)
    expect(await source.pasteIntoTarget(target)).toEqual({
      status: 'unavailable',
      reason: 'test_paste_unavailable',
    })

    expect(paste).toHaveBeenCalledExactlyOnceWith(folder.id)
  })

  it('derives item paste targets from the clicked item parent', () => {
    const folder = createFolder({ name: 'Scenes' })
    const note = createNote({ name: 'Ambush', parentId: folder.id })
    const otherFolder = createFolder({ name: 'Archive' })
    const otherNote = createNote({ name: 'Decoy', parentId: otherFolder.id })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, note, otherFolder, otherNote],
      trashItems: [],
    }).catalog
    const clipboardDriver = createClipboardDriver({
      canPaste: vi.fn((targetParentId) => targetParentId === folder.id),
    })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      clipboardDriver,
      operationDriver: createOperationDriver(),
    })
    vi.mocked(clipboardDriver.canPaste).mockClear()

    expect(
      source.canPasteIntoTarget({
        clickedItem: note,
      }),
    ).toBe(true)
    expect(clipboardDriver.canPaste).toHaveBeenCalledExactlyOnceWith(folder.id)
  })

  it('uses the dedicated clipboard driver for clipboard operations', async () => {
    const folder = createFolder({ name: 'Scenes' })
    const note = createNote({ name: 'Ambush' })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, note],
      trashItems: [],
    }).catalog
    const clipboardDriver = createClipboardDriver({
      canPaste: vi.fn((targetParentId) => targetParentId === folder.id),
      paste: vi.fn(() => unavailablePasteResult),
    })
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      clipboardDriver,
      operationDriver: createOperationDriver(),
    })

    const target = {
      clickedItem: folder,
    }
    vi.mocked(clipboardDriver.canPaste).mockClear()

    expect(source.canPasteIntoTarget(target)).toBe(true)
    expect(await source.pasteIntoTarget(target)).toEqual({
      status: 'unavailable',
      reason: 'test_paste_unavailable',
    })

    expect(clipboardDriver.canPaste).toHaveBeenCalledExactlyOnceWith(folder.id)
    expect(clipboardDriver.paste).toHaveBeenCalledExactlyOnceWith(folder.id)
  })

  it('leaves blank context-menu paste targets to the active surface resolver', async () => {
    const paste = vi.fn(() => unavailablePasteResult)
    const clipboardDriver = createClipboardDriver({
      canPaste: () => true,
      paste,
    })
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [],
    }).catalog
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      clipboardDriver,
      operationDriver: createOperationDriver(),
    })
    const target = {
      clickedItem: undefined,
    }

    expect(source.canPasteIntoTarget(target)).toBe(true)
    expect(await source.pasteIntoTarget(target)).toEqual({
      status: 'unavailable',
      reason: 'test_paste_unavailable',
    })

    expect(paste).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('routes trash operations through the dedicated trash driver', async () => {
    const folder = createFolder({ name: 'Scenes' })
    const note = createNote({ name: 'Ambush', parentId: folder.id })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, note],
      trashItems: [],
    }).catalog
    const trashDriver = createTrashDriver()
    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver: createOperationDriver(),
      trashDriver,
    })

    await source.trashItems([note.id])
    await source.restoreItems([note.id], folder.id)
    source.requestDeleteItemsForever([note.id])
    source.requestEmptyTrash()

    expect(trashDriver.requestTrashItems).toHaveBeenCalledExactlyOnceWith([note.id])
    expect(trashDriver.restoreItems).toHaveBeenCalledExactlyOnceWith([note.id], folder.id)
    expect(trashDriver.confirmDeleteForever).toHaveBeenCalledExactlyOnceWith([note.id])
    expect(trashDriver.confirmEmptyTrash).toHaveBeenCalledOnce()
  })

  it('renames the current item and replaces navigation with the returned slug', async () => {
    const note = createNote({ name: 'Scene', slug: 'scene' })
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog
    const navigateToItem = vi.fn()
    const setLastSelectedItem = vi.fn()
    const operationDriver = createOperationDriver({
      renameItem: vi.fn().mockResolvedValue({ slug: 'renamed-scene' }),
    })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      currentItem: note,
      operationDriver,
      navigateToItem,
      setLastSelectedItem,
    })

    await expect(
      source.updateItemMetadata({ item: note, name: ' Renamed Scene ' }),
    ).resolves.toEqual({ slug: 'renamed-scene' })

    expect(operationDriver.renameItem).toHaveBeenCalledWith({
      itemId: note.id,
      name: 'Renamed Scene',
      iconName: undefined,
      color: undefined,
    })
    expect(setLastSelectedItem).toHaveBeenCalledWith('renamed-scene')
    expect(navigateToItem).toHaveBeenCalledWith('renamed-scene', { replace: true })
  })

  it('returns the rename result when refreshing current item navigation fails', async () => {
    const note = createNote({ name: 'Scene', slug: 'scene' })
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog
    const navigationError = new Error('navigation failed')
    const operationDriver = createOperationDriver({
      renameItem: vi.fn().mockResolvedValue({ slug: 'renamed-scene' }),
    })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      currentItem: note,
      operationDriver,
      navigateToItem: vi.fn().mockRejectedValue(navigationError),
    })

    await expect(source.updateItemMetadata({ item: note, name: 'Renamed Scene' })).resolves.toEqual(
      { slug: 'renamed-scene' },
    )
  })

  it('rejects changed metadata when the operation driver cannot complete a rename', async () => {
    const note = createNote({ name: 'Scene', slug: 'scene' })
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog
    const renameError = new Error('rename did not complete')
    const operationDriver = createOperationDriver({
      renameItem: vi.fn().mockRejectedValue(renameError),
    })

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    await expect(source.updateItemMetadata({ item: note, name: 'Renamed Scene' })).rejects.toThrow(
      'Failed to update item metadata',
    )
  })

  it('returns the current slug without mutating unchanged metadata', async () => {
    const note = createNote({ name: 'Scene', slug: 'scene', iconName: 'FileText' })
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog
    const operationDriver = createOperationDriver()

    const source = createTestWorkspaceFileSystemOperations({
      catalog,
      operationDriver,
    })

    await expect(
      source.updateItemMetadata({
        item: note,
        name: ' Scene ',
        iconName: 'FileText',
      }),
    ).resolves.toEqual({ slug: 'scene' })

    expect(operationDriver.renameItem).not.toHaveBeenCalled()
  })
})

function createTestWorkspaceFileSystemOperations({
  canCreateItems = true,
  canManageFolders = true,
  catalog,
  clipboardDriver = createClipboardDriver(),
  currentItem = null,
  dropDriver = createDropDriver(),
  operationDriver,
  navigateToItem = vi.fn(),
  onItemSlugChange = vi.fn(),
  setLastSelectedItem = vi.fn(),
  trashDriver = createTrashDriver(),
}: {
  canCreateItems?: boolean
  canManageFolders?: boolean
  catalog: ReturnType<typeof createResourceCatalogModel>['catalog']
  clipboardDriver?: TestWorkspaceFileSystemClipboardDriver
  currentItem?: AnyItem | null
  dropDriver?: TestWorkspaceFileSystemDropDriver
  operationDriver: TestWorkspaceFileSystemOperationDriver
  navigateToItem?: TestWorkspaceFileSystemNavigateToItem
  onItemSlugChange?: (itemId: SidebarItemId, slug: ResourceSlug | null) => void
  setLastSelectedItem?: (slug: ResourceSlug) => void
  trashDriver?: TestWorkspaceFileSystemTrashDriver
}) {
  return createWorkspaceFileSystemOperations({
    capabilities: {
      createItems: canCreateItems
        ? { status: 'available' }
        : { status: 'unsupported', reason: 'test' },
      manageFolders: canManageFolders
        ? { status: 'available' }
        : { status: 'unsupported', reason: 'test' },
    },
    catalog,
    contentInitializers,
    clipboardDriver,
    currentItem,
    dropDriver,
    operationDriver,
    navigateToItem,
    onItemSlugChange,
    reportCreateItemError: vi.fn(),
    setLastSelectedItem,
    trashDriver,
  })
}
