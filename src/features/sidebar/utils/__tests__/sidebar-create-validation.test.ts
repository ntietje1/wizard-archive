import { describe, expect, it } from 'vitest'
import {
  CREATE_PARENT_TARGET_KIND,
  validateCreateItemLocally,
  validateCreateParentTarget,
} from 'convex/sidebarItems/validation/parent'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function buildItemsMap(items: Array<AnySidebarItem>) {
  return new Map(items.map((item) => [item._id, item]))
}

function buildParentItemsMap(items: Array<AnySidebarItem>) {
  const map = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()

  for (const item of items) {
    const siblings = map.get(item.parentId) ?? []
    siblings.push(item)
    map.set(item.parentId, siblings)
  }

  return map
}

describe('validateCreateParentTarget', () => {
  it('rejects traversal above root', () => {
    const items: Array<AnySidebarItem> = []

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['..', 'Archive'],
      },
      buildItemsMap(items),
      buildParentItemsMap(items),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Path cannot traverse above the campaign root',
    })
  })

  it('rejects non-folder collisions in the path', () => {
    const note = createNote({
      _id: testId<'sidebarItems'>('note_path_collision'),
      name: 'Taken',
      parentId: null,
    })
    const items = [note]

    const result = validateCreateParentTarget(
      {
        kind: CREATE_PARENT_TARGET_KIND.path,
        baseParentId: null,
        pathSegments: ['Taken', 'Child'],
      },
      buildItemsMap(items),
      buildParentItemsMap(items),
    )

    expect(result).toEqual({
      valid: false,
      error: '"Taken" already exists here and is not a folder',
    })
  })
})

describe('validateCreateItemLocally', () => {
  it('rejects traversal-only names through the same local create validation', () => {
    const items: Array<AnySidebarItem> = []

    const result = validateCreateItemLocally(
      {
        name: '..',
        parentTarget: {
          kind: CREATE_PARENT_TARGET_KIND.path,
          baseParentId: null,
          pathSegments: ['..', '..'],
        },
      },
      buildItemsMap(items),
      buildParentItemsMap(items),
    )

    expect(result).toEqual({
      valid: false,
      error: 'Path cannot traverse above the campaign root',
    })
  })

  it('checks sibling conflicts once the parent path resolves locally', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_world'),
      name: 'World',
      parentId: null,
    })
    const existingNote = createNote({
      _id: testId<'sidebarItems'>('note_capital'),
      name: 'Capital',
      parentId: folder._id,
    })
    const items = [folder, existingNote]

    const result = validateCreateItemLocally(
      {
        name: 'Capital',
        parentTarget: {
          kind: CREATE_PARENT_TARGET_KIND.path,
          baseParentId: null,
          pathSegments: ['World'],
        },
      },
      buildItemsMap(items),
      buildParentItemsMap(items),
    )

    expect(result).toEqual({
      valid: false,
      error: 'An item with this name already exists here',
    })
  })
})
