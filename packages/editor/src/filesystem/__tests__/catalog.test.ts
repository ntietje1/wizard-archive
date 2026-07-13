import { describe, expect, it } from 'vite-plus/test'
import { SHARE_STATUS } from '../../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { testNoteBlockId } from '../../test/blocknote-id'
import { createResourceCatalogModel } from '../catalog'

describe('createResourceCatalogModel', () => {
  it('indexes active children by parent from the supplied catalog items', () => {
    const folder = createFolder({ name: 'Visible Folder' })
    const root = createNote({ name: 'Root Note', isBookmarked: true })
    const visibleChild = createNote({ name: 'Visible Child', parentId: folder.id })
    const hiddenChild = createNote({ name: 'Hidden Child', parentId: folder.id })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, root, visibleChild, hiddenChild],
      visibleActiveItems: [folder, root, visibleChild],
      trashItems: [],
    }).catalog

    expect(catalog.getKnownItemById(hiddenChild.id)).toEqual(hiddenChild)
    expect(catalog.getVisibleItemById(visibleChild.id)).toEqual(visibleChild)
    expect(catalog.getVisibleAncestors(visibleChild.id)).toEqual([folder])
    expect(catalog.getVisibleItems()).toEqual([folder, root, visibleChild])
    expect(catalog.getVisibleRoots()).toEqual([folder, root])
    expect(catalog.getVisibleChildren(folder.id)).toEqual([visibleChild])
  })

  it('indexes trash children separately from active children', () => {
    const folder = createFolder({
      name: 'Deleted Folder',
      status: RESOURCE_STATUS.trashed,
    })
    const child = createNote({
      name: 'Deleted Child',
      parentId: folder.id,
      status: RESOURCE_STATUS.trashed,
    })
    const catalog = createResourceCatalogModel({
      activeItems: [],
      trashItems: [folder, child],
    }).catalog

    expect(catalog.getTrashedItems()).toEqual([folder, child])
    expect(catalog.getTrashedRoots()).toEqual([folder])
    expect(catalog.getTrashedChildren(folder.id)).toEqual([child])
  })

  it('returns stable catalog arrays after caller-side mutations', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id })
    const trashed = createNote({
      name: 'Trash',
      status: RESOURCE_STATUS.trashed,
    })
    const activeItems = [folder, child]
    const catalog = createResourceCatalogModel({
      activeItems,
      trashItems: [trashed],
    }).catalog

    ;(catalog.getVisibleItems() as Array<AnyItem>).pop()
    ;(catalog.getVisibleRoots() as Array<AnyItem>).pop()
    ;(catalog.getVisibleChildren(folder.id) as Array<AnyItem>).pop()
    ;(catalog.getTrashedItems() as Array<AnyItem>).pop()
    ;(catalog.getTrashedRoots() as Array<AnyItem>).pop()

    expect(catalog.getVisibleItems()).toEqual([folder, child])
    expect(catalog.getVisibleRoots()).toEqual([folder])
    expect(catalog.getVisibleChildren(folder.id)).toEqual([child])
    expect(catalog.getTrashedItems()).toEqual([trashed])
    expect(catalog.getTrashedRoots()).toEqual([trashed])
  })

  it('snapshots constructor inputs so later adapter mutations preserve the initial catalog view', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id })
    const activeItems = [folder, child]
    const visibleActiveItems = [...activeItems]
    const trashItems = [
      createNote({
        name: 'Trash',
        status: RESOURCE_STATUS.trashed,
      }),
    ]
    const catalog = createResourceCatalogModel({
      activeItems,
      visibleActiveItems,
      trashItems,
    }).catalog

    activeItems.push(createNote({ name: 'Extra' }))
    visibleActiveItems.shift()
    trashItems.pop()

    expect(catalog.getKnownItemById(folder.id)).toEqual(folder)
    expect(catalog.getVisibleItemById(folder.id)).toEqual(folder)
    expect(catalog.getVisibleItems()).toEqual([folder, child])
    expect(catalog.getVisibleRoots()).toEqual([folder])
    expect(catalog.getTrashedItems()).toHaveLength(1)
  })

  it('builds visible link disambiguation paths from catalog queries', () => {
    const firstFolder = createFolder({ name: 'First Folder' })
    const secondFolder = createFolder({ name: 'Second Folder' })
    const firstNote = createNote({ name: 'Scene', parentId: firstFolder.id })
    const secondNote = createNote({ name: 'Scene', parentId: secondFolder.id })
    const { paths } = createResourceCatalogModel({
      activeItems: [firstFolder, secondFolder, firstNote, secondNote],
      trashItems: [],
    })

    expect(paths.getVisibleItemLinkPath(secondNote)).toEqual(['Second Folder', 'Scene'])
  })

  it('builds visible link paths from the visible item set', () => {
    const visibleFolder = createFolder({ name: 'Visible Folder' })
    const hiddenFolder = createFolder({ name: 'Hidden Folder' })
    const visibleNote = createNote({ name: 'Scene', parentId: visibleFolder.id })
    const hiddenNote = createNote({ name: 'Scene', parentId: hiddenFolder.id })
    const { catalog, paths } = createResourceCatalogModel({
      activeItems: [visibleFolder, hiddenFolder, visibleNote, hiddenNote],
      visibleActiveItems: [visibleFolder, visibleNote],
      trashItems: [],
    })

    expect(catalog.getKnownItemById(hiddenNote.id)).toEqual(hiddenNote)
    expect(paths.getVisibleItemLinkPath(visibleNote)).toEqual(['Scene'])
  })

  it('keeps catalog item snapshots stable after caller-side item mutations', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id, slug: 'child' })
    const catalog = createResourceCatalogModel({
      activeItems: [folder, child],
      trashItems: [],
    }).catalog

    child.parentId = null
    child.slug = 'renamed-child' as typeof child.slug
    child.status = RESOURCE_STATUS.trashed
    child.isTrashed = true

    expect(catalog.getVisibleRoots().map((item) => item.id)).toEqual([folder.id])
    expect(catalog.getVisibleChildren(folder.id).map((item) => item.id)).toEqual([child.id])
    expect(catalog.getVisibleItemBySlug('child' as typeof child.slug)).toMatchObject({
      id: child.id,
      parentId: folder.id,
      slug: 'child',
      isTrashed: false,
    })
    expect(catalog.getVisibleItemBySlug('renamed-child' as typeof child.slug)).toBeNull()
  })

  it('prevents catalog consumers from mutating returned item snapshots', () => {
    const note = createNote({ name: 'Child', slug: 'child' })
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog
    const catalogNote = catalog.getVisibleItemById(note.id)

    expect(() => {
      catalogNote!.parentId = testParentId
    }).toThrow(TypeError)
    expect(catalog.getVisibleItemById(note.id)).toMatchObject({
      parentId: null,
      slug: 'child',
    })
  })

  it('detaches nested item content from caller-owned catalog inputs', () => {
    const note: NoteItemWithContent = {
      ...createNote({ name: 'Child', slug: 'child' }),
      ancestors: [],
      content: [{ id: testNoteBlockId('block-1'), type: 'paragraph', props: {}, content: [] }],
      blockMeta: {
        'block-1': {
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          sharedWith: [],
        },
      },
      blockShareAccessWarnings: [],
    }
    const catalog = createResourceCatalogModel({
      activeItems: [note],
      trashItems: [],
    }).catalog

    note.content.push({
      id: testNoteBlockId('block-2'),
      type: 'paragraph',
      props: {},
      content: [],
    })
    note.blockMeta['block-1'].sharedWith.push('member-1' as never)

    const catalogNote = catalog.getVisibleItemById(note.id) as NoteItemWithContent
    expect(catalogNote.content).toHaveLength(1)
    expect(catalogNote.blockMeta['block-1'].sharedWith).toEqual([])
    expect(() => {
      catalogNote.content.push({
        id: testNoteBlockId('block-3'),
        type: 'paragraph',
        props: {},
        content: [],
      })
    }).toThrow(TypeError)
  })

  it('resolves visible global and relative item paths from catalog queries', () => {
    const folder = createFolder({ name: 'Lore' })
    const sourceNote = createNote({ name: 'Current Note', parentId: folder.id })
    const siblingNote = createNote({ name: 'Sibling Note', parentId: folder.id })
    const { paths } = createResourceCatalogModel({
      activeItems: [folder, sourceNote, siblingNote],
      visibleActiveItems: [folder, sourceNote, siblingNote],
      trashItems: [],
    })

    expect(
      paths.resolveVisibleItemPath({
        pathKind: 'global',
        pathSegments: ['Lore', 'Sibling Note'],
      }),
    ).toEqual(siblingNote)
    expect(
      paths.resolveVisibleItemPath({
        pathKind: 'relative',
        pathSegments: ['.', 'Sibling Note'],
        sourceItemId: sourceNote.id,
      }),
    ).toEqual(siblingNote)
  })

  it('resolves relative item paths from folder sources inside the folder', () => {
    const folder = createFolder({ name: 'Lore' })
    const childNote = createNote({ name: 'Scene', parentId: folder.id })
    const siblingFolder = createFolder({ name: 'Sibling Folder' })
    const { paths } = createResourceCatalogModel({
      activeItems: [folder, childNote, siblingFolder],
      visibleActiveItems: [folder, childNote, siblingFolder],
      trashItems: [],
    })

    expect(
      paths.resolveVisibleItemPath({
        pathKind: 'relative',
        pathSegments: ['Scene'],
        sourceItemId: folder.id,
      }),
    ).toEqual(childNote)
    expect(
      paths.resolveVisibleFolderPath({
        pathKind: 'relative',
        pathSegments: ['..', 'Sibling Folder'],
        sourceItemId: folder.id,
      }),
    ).toBe(siblingFolder.id)
  })

  it('queries visible items and resolves visible note/folder paths from catalog queries', () => {
    const folder = createFolder({ name: 'Lore' })
    const sourceNote = createNote({ name: 'Current Note', parentId: folder.id })
    const siblingNote = createNote({ name: 'Sibling Note', parentId: folder.id })
    const { catalog, paths } = createResourceCatalogModel({
      activeItems: [folder, sourceNote, siblingNote],
      visibleActiveItems: [folder, sourceNote, siblingNote],
      trashItems: [],
    })

    expect(catalog.queryVisibleItems()).toEqual([folder, sourceNote, siblingNote])
    expect(catalog.queryVisibleItems({ parentId: folder.id })).toEqual([sourceNote, siblingNote])
    expect(catalog.queryVisibleItems({ type: sourceNote.type })).toEqual([sourceNote, siblingNote])
    expect(catalog.getVisibleAncestors(siblingNote.id)).toEqual([folder])
    expect(
      paths.resolveVisibleFolderPath({
        pathKind: 'relative',
        pathSegments: ['.'],
        sourceItemId: sourceNote.id,
      }),
    ).toBe(folder.id)
    expect(
      paths.resolveVisibleNotePath({
        text: './Sibling Note',
        sourceItemId: sourceNote.id,
      }),
    ).toEqual(siblingNote)
  })

  it('anchors relative paths to the visible tree when the source parent is hidden', () => {
    const hiddenFolder = createFolder({ name: 'Hidden Folder' })
    const sourceNote = createNote({ name: 'Current Note', parentId: hiddenFolder.id })
    const visibleRootNote = createNote({ name: 'Visible Root Note' })
    const visibleRootFolder = createFolder({ name: 'Visible Root Folder' })
    const { catalog, paths } = createResourceCatalogModel({
      activeItems: [hiddenFolder, sourceNote, visibleRootNote, visibleRootFolder],
      visibleActiveItems: [sourceNote, visibleRootNote, visibleRootFolder],
      trashItems: [],
    })

    expect(catalog.getKnownItemById(sourceNote.id)?.parentId).toBe(hiddenFolder.id)
    expect(catalog.getVisibleItemById(sourceNote.id)?.parentId).toBeNull()
    expect(catalog.getVisibleRoots().map((item) => item.id)).toEqual([
      sourceNote.id,
      visibleRootNote.id,
      visibleRootFolder.id,
    ])
    expect(
      paths.resolveVisibleFolderPath({
        pathKind: 'relative',
        pathSegments: [],
        sourceItemId: sourceNote.id,
      }),
    ).toBeNull()
    expect(
      paths.resolveVisibleItemPath({
        pathKind: 'relative',
        pathSegments: ['.', 'Visible Root Note'],
        sourceItemId: sourceNote.id,
      }),
    ).toEqual(visibleRootNote)
    expect(
      paths.resolveVisibleFolderPath({
        pathKind: 'relative',
        pathSegments: ['Visible Root Folder'],
        sourceItemId: sourceNote.id,
      }),
    ).toBe(visibleRootFolder.id)
  })

  it('re-roots visible items that participate in a parent cycle', () => {
    const first = createFolder({
      id: createFolderId('visible-cycle-first'),
      parentId: createFolderId('visible-cycle-second'),
    })
    const second = createFolder({
      id: createFolderId('visible-cycle-second'),
      parentId: first.id,
    })
    const { catalog } = createResourceCatalogModel({
      activeItems: [first, second],
      visibleActiveItems: [first, second],
      trashItems: [],
    })

    expect(catalog.getVisibleRoots().map((item) => item.id)).toEqual([first.id, second.id])
    expect(catalog.getVisibleChildren(null).map((item) => item.id)).toEqual([first.id, second.id])
  })

  it('fails closed when a known ancestor chain contains a cycle', () => {
    const first = createFolder({
      id: createFolderId('cycle-first'),
      parentId: createFolderId('cycle-second'),
    })
    const second = createFolder({
      id: createFolderId('cycle-second'),
      parentId: first.id,
    })
    const { operationItems } = createResourceCatalogModel({
      activeItems: [first, second],
      trashItems: [],
    })

    expect(() => operationItems.resolveItems({ itemIds: [first.id] })).toThrow(
      'Cycle detected while normalizing selected resources',
    )
  })
})

const testParentId = 'catalog-test-parent' as AnyItem['id']

function createFolderId(value: string) {
  return value as AnyItem['id']
}
