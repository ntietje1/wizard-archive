import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { CREATE_PARENT_TARGET_KIND } from '../../items'
import type { AnyItem } from '../../items'
import {
  planCreateParentTarget,
  validateCreateParentTarget,
} from '../../items/create-parent-target'
import { RESOURCE_STATUS } from '../../items-persistence-contract'
import { validateCreateItemLocally } from '../../items/local-create-validation'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'

function buildValidationSource(
  items: Array<AnyItem>,
  options: { includeInactiveChildren?: boolean } = {},
) {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const map = new Map<SidebarItemId | null, Array<AnyItem>>()

  for (const item of items) {
    if (!options.includeInactiveChildren && item.status !== RESOURCE_STATUS.active) continue
    const siblings = map.get(item.parentId) ?? []
    siblings.push(item)
    map.set(item.parentId, siblings)
  }

  return {
    getItemById: (itemId: SidebarItemId) => itemsById.get(itemId),
    getActiveChildren: (parentId: SidebarItemId | null) => map.get(parentId) ?? [],
  }
}

describe('validateCreateParentTarget', () => {
  it('rejects traversal above root', () => {
    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['..', 'Archive'],
      },
      buildValidationSource([]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Path cannot traverse above the workspace root',
    })
  })

  it('rejects non-folder collisions in the path', () => {
    const note = createNote({
      id: testId('note_path_collision'),
      name: 'Taken',
      parentId: null,
    })

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Taken', 'Child'],
      },
      buildValidationSource([note]),
    )

    expect(result).toEqual({
      valid: false,
      error: '"Taken" already exists here and is not a folder',
    })
  })

  it('rejects a trashed direct parent', () => {
    const folder = createFolder({
      id: testId('trashed_direct_parent'),
      status: RESOURCE_STATUS.trashed,
    })

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.direct,
        parentId: folder.id,
      },
      buildValidationSource([folder]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Parent not found',
    })
  })

  it('rejects a trashed path base parent', () => {
    const folder = createFolder({
      id: testId('trashed_path_base_parent'),
      status: RESOURCE_STATUS.trashed,
    })

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: folder.id,
        pathSegments: ['Child'],
      },
      buildValidationSource([folder]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Parent not found',
    })
  })

  it('rejects path parents whose ancestor chain contains a non-folder item', () => {
    const noteAncestor = createNote({
      id: testId('note_path_ancestor'),
      name: 'Scene',
      parentId: null,
    })
    const childFolder = createFolder({
      id: testId('folder_under_note'),
      name: 'Impossible Folder',
      parentId: noteAncestor.id,
    })

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: childFolder.id,
        pathSegments: ['Archive'],
      },
      buildValidationSource([noteAncestor, childFolder]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Parent is not a folder',
    })
  })

  it('does not resolve trashed child folders as path parents', () => {
    const folder = createFolder({
      id: testId('trashed_path_child_parent'),
      name: 'Archive',
      parentId: null,
      status: RESOURCE_STATUS.trashed,
    })

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Archive'],
      },
      buildValidationSource([folder], { includeInactiveChildren: true }),
    )

    expect(result).toEqual({
      valid: true,
      parentId: null,
      siblings: [],
    })
  })
})

describe('planCreateParentTarget', () => {
  it('plans existing and virtual path folders through package-owned create-parent semantics', () => {
    const folder = createFolder({
      id: testId('folder_lore'),
      name: 'Lore',
      parentId: null,
    })

    const result = planCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Lore', 'Capital'],
      },
      buildValidationSource([folder]),
    )

    expect(result).toEqual({
      kind: 'path',
      folders: [
        { kind: 'existing', id: folder.id },
        { kind: 'virtual', name: 'Capital' },
      ],
    })
  })

  it('reuses pending path folders before the catalog refreshes', () => {
    const loreId = testId<'sidebarItems'>('pending_lore')
    const capitalId = testId<'sidebarItems'>('pending_capital')

    const result = planCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Lore', 'Capital'],
      },
      buildValidationSource([]),
      {
        resolvePendingFolder: ({ name, parentId }) => {
          if (parentId === null && name === 'Lore') return loreId
          if (parentId === loreId && name === 'Capital') return capitalId
          return null
        },
      },
    )

    expect(result).toEqual({
      kind: 'path',
      folders: [
        { kind: 'existing', id: loreId },
        { kind: 'existing', id: capitalId },
      ],
    })
  })

  it('plans child paths under a pending base folder before the catalog refreshes', () => {
    const loreId = testId<'sidebarItems'>('pending_lore')
    const capitalId = testId<'sidebarItems'>('pending_capital')

    const result = planCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: loreId,
        pathSegments: ['Capital'],
      },
      buildValidationSource([]),
      {
        createdFolderIds: new Set([loreId]),
        resolvePendingFolder: ({ name, parentId }) =>
          parentId === loreId && name === 'Capital' ? capitalId : null,
      },
    )

    expect(result).toEqual({
      kind: 'path',
      folders: [
        { kind: 'existing', id: loreId },
        { kind: 'existing', id: capitalId },
      ],
    })
  })
})

describe('validateCreateItemLocally', () => {
  it('rejects names with leading or trailing whitespace', () => {
    const result = validateCreateItemLocally(
      {
        name: ' New note ',
        parentTarget: {
          kind: CREATE_PARENT_TARGET_KIND.direct,
          parentId: null,
        },
      },
      buildValidationSource([]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Name cannot start or end with whitespace',
    })
  })

  it('rejects traversal-only names through the same local create validation', () => {
    const result = validateCreateItemLocally(
      {
        name: '..',
        parentTarget: {
          kind: CREATE_PARENT_TARGET_KIND.path,
          baseParentId: null,
          pathSegments: ['..', '..'],
        },
      },
      buildValidationSource([]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Path cannot traverse above the workspace root',
    })
  })

  it('checks sibling conflicts once the parent path resolves locally', () => {
    const folder = createFolder({
      id: testId('folder_world'),
      name: 'World',
      parentId: null,
    })
    const existingNote = createNote({
      id: testId('note_capital'),
      name: 'Capital',
      parentId: folder.id,
    })

    const result = validateCreateItemLocally(
      {
        name: 'Capital',
        parentTarget: {
          kind: CREATE_PARENT_TARGET_KIND.path,
          baseParentId: null,
          pathSegments: ['World'],
        },
      },
      buildValidationSource([folder, existingNote]),
    )

    expect(result).toEqual({
      valid: false,
      error: 'An item with this name already exists here',
    })
  })
})
