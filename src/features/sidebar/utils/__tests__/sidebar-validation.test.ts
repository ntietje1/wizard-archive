import { describe, expect, it } from 'vitest'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import {
  getAncestorIds,
  validateNoCircularParent,
  validateParentChange,
  validateSidebarItem,
  validateSidebarItemName,
} from '~/features/sidebar/utils/sidebar-validation'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function buildMap(items: Array<AnySidebarItem>) {
  const map = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  for (const item of items) map.set(item._id, item)
  return map
}

describe('validateSidebarItemName', () => {
  it('accepts valid names', () => {
    expect(validateSidebarItemName({ name: 'My Note' })).toEqual({
      valid: true,
    })
  })

  it('rejects empty names', () => {
    const result = validateSidebarItemName({ name: '' })
    expect(result.valid).toBe(false)
  })

  it('rejects whitespace-only names', () => {
    const result = validateSidebarItemName({ name: '   ' })
    expect(result.valid).toBe(false)
  })

  it('rejects names with forbidden characters', () => {
    for (const char of ['/', '\\', ':', '*', '?', '"', '<', '>', '[', ']', '#', '|']) {
      const result = validateSidebarItemName({ name: `test${char}name` })
      expect(result.valid).toBe(false)
    }
  })

  it('rejects names longer than 255 characters', () => {
    const result = validateSidebarItemName({ name: 'a'.repeat(256) })
    expect(result.valid).toBe(false)
  })

  it('accepts names at exactly 255 characters', () => {
    const result = validateSidebarItemName({ name: 'a'.repeat(255) })
    expect(result).toEqual({ valid: true })
  })

  it('rejects names starting or ending with a dot', () => {
    expect(validateSidebarItemName({ name: '.hidden' }).valid).toBe(false)
    expect(validateSidebarItemName({ name: 'file.' }).valid).toBe(false)
  })

  it('rejects names that would generate an empty slug', () => {
    expect(validateSidebarItemName({ name: '🎉🎊' }).valid).toBe(false)
  })

  it('rejects names with control characters', () => {
    expect(validateSidebarItemName({ name: 'line\nbreak' }).valid).toBe(false)
    expect(validateSidebarItemName({ name: 'line\rbreak' }).valid).toBe(false)
    expect(validateSidebarItemName({ name: 'line\tbreak' }).valid).toBe(false)
    expect(validateSidebarItemName({ name: 'line\0break' }).valid).toBe(false)
    expect(validateSidebarItemName({ name: 'line\u0085break' }).valid).toBe(false)
  })

  it('detects sibling name conflicts (case-insensitive)', () => {
    const existing = createNote({ name: 'My Note' })
    const result = validateSidebarItemName({
      name: 'my note',
      siblings: [existing],
    })
    expect(result.valid).toBe(false)
  })

  it('allows same name when excludeId matches', () => {
    const existing = createNote({ name: 'My Note' })
    const result = validateSidebarItemName({
      name: 'My Note',
      siblings: [existing],
      itemId: existing._id,
    })
    expect(result).toEqual({ valid: true })
  })
})

describe('validateNoCircularParent', () => {
  it('allows moving to root', () => {
    const folder = createFolder({ _id: testId<'sidebarItems'>('folder_c1') })
    const result = validateNoCircularParent(folder._id, null, buildMap([folder]))
    expect(result).toEqual({ valid: true })
  })

  it('rejects self as parent', () => {
    const folder = createFolder({ _id: testId<'sidebarItems'>('folder_c2') })
    const result = validateNoCircularParent(folder._id, folder._id, buildMap([folder]))
    expect(result.valid).toBe(false)
  })

  it('detects circular references', () => {
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_cp'),
      parentId: null,
    })
    const child = createFolder({
      _id: testId<'sidebarItems'>('folder_cc'),
      parentId: parent._id,
    })
    const result = validateNoCircularParent(parent._id, child._id, buildMap([parent, child]))
    expect(result.valid).toBe(false)
  })
})

describe('getAncestorIds', () => {
  it('returns ancestor IDs for nested item', () => {
    const gp = createFolder({
      _id: testId<'sidebarItems'>('folder_anc_gp'),
      parentId: null,
    })
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_anc_p'),
      parentId: gp._id,
    })
    const note = createNote({ parentId: parent._id })
    const map = buildMap([gp, parent, note])
    const ids = getAncestorIds(note._id, map)
    expect(ids).toEqual([parent._id, gp._id])
  })

  it('returns empty for root item', () => {
    const note = createNote({ parentId: null })
    expect(getAncestorIds(note._id, buildMap([note]))).toEqual([])
  })

  it('returns empty for item not in map', () => {
    expect(getAncestorIds(testId<'sidebarItems'>('nonexistent'), new Map())).toEqual([])
  })
})

describe('validateParentChange', () => {
  it('allows valid parent change to non-descendant', () => {
    const folderA = createFolder({
      _id: testId<'sidebarItems'>('folder_pc_a'),
      parentId: null,
    })
    const folderB = createFolder({
      _id: testId<'sidebarItems'>('folder_pc_b'),
      parentId: null,
    })
    const result = validateParentChange({
      itemId: folderA._id,
      parentId: folderB._id,
      itemsMap: buildMap([folderA, folderB]),
    })
    expect(result).toEqual({ valid: true })
  })

  it('returns valid when no itemId provided', () => {
    expect(validateParentChange({ itemId: undefined, parentId: null })).toEqual({ valid: true })
  })

  it('returns valid when no itemsMap provided', () => {
    const folder = createFolder({ _id: testId<'sidebarItems'>('folder_pc1') })
    expect(
      validateParentChange({
        itemId: folder._id,
        parentId: testId<'sidebarItems'>('folder_other'),
        itemsMap: undefined,
      }),
    ).toEqual({ valid: true })
  })

  it('detects circular reference via validateNoCircularParent', () => {
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_pc_p'),
      parentId: null,
    })
    const child = createFolder({
      _id: testId<'sidebarItems'>('folder_pc_c'),
      parentId: parent._id,
    })
    const result = validateParentChange({
      itemId: parent._id,
      parentId: child._id,
      itemsMap: buildMap([parent, child]),
    })
    expect(result.valid).toBe(false)
  })
})

describe('validateSidebarItem', () => {
  it('rejects self-parenting when isMove is true', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_v1'),
      parentId: null,
    })
    const result = validateSidebarItem({
      name: 'Valid Name',
      parentId: folder._id,
      itemId: folder._id,
      itemsMap: buildMap([folder]),
      isMove: true,
    })
    expect(result.valid).toBe(false)
  })

  it('skips parent validation when not a move', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_v2'),
      parentId: null,
    })
    const result = validateSidebarItem({
      name: 'Valid Name',
      parentId: folder._id,
      itemId: folder._id,
      itemsMap: buildMap([folder]),
      isMove: false,
    })
    expect(result).toEqual({ valid: true })
  })

  it('fails fast on name validation before checking parent', () => {
    const result = validateSidebarItem({
      name: '',
      parentId: null,
      isMove: true,
    })
    expect(result.valid).toBe(false)
  })

  it('passes with valid name and no siblings', () => {
    const result = validateSidebarItem({
      name: 'Good Name',
      parentId: null,
    })
    expect(result).toEqual({ valid: true })
  })

  it('detects name conflict in combined validation', () => {
    const sibling = createNote({ name: 'Taken' })
    const result = validateSidebarItem({
      name: 'taken',
      parentId: null,
      siblings: [sibling],
    })
    expect(result.valid).toBe(false)
  })
})
