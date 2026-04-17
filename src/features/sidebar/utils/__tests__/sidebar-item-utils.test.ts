import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  isValidSidebarItemColor,
  normalizeSidebarItemColorOrDefault,
} from 'convex/sidebarItems/color'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { assertSidebarItemSlug } from 'convex/sidebarItems/slug'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import {
  buildBreadcrumbs,
  getDefaultIconName,
  getItemTypeLabel,
  getSidebarItemAs,
  getSlug,
  isFile,
  isFolder,
  isGameMap,
  isNote,
  isSidebarItemType,
} from '~/features/sidebar/utils/sidebar-item-utils'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

describe('type guards', () => {
  it('isNote identifies notes correctly', () => {
    expect(isNote(createNote())).toBe(true)
    expect(isNote(createFolder())).toBe(false)
    expect(isNote(null)).toBe(false)
    expect(isNote(undefined)).toBe(false)
  })

  it('isFolder identifies folders correctly', () => {
    expect(isFolder(createFolder())).toBe(true)
    expect(isFolder(createNote())).toBe(false)
    expect(isFolder(null)).toBe(false)
    expect(isFolder(undefined)).toBe(false)
  })

  it('isGameMap identifies game maps correctly', () => {
    expect(isGameMap(createGameMap())).toBe(true)
    expect(isGameMap(createNote())).toBe(false)
    expect(isGameMap(null)).toBe(false)
    expect(isGameMap(undefined)).toBe(false)
  })

  it('isFile identifies files correctly', () => {
    expect(isFile(createFile())).toBe(true)
    expect(isFile(createNote())).toBe(false)
    expect(isFile(null)).toBe(false)
    expect(isFile(undefined)).toBe(false)
  })

  it('isSidebarItemType works with explicit type parameter', () => {
    expect(isSidebarItemType(createNote(), SIDEBAR_ITEM_TYPES.notes)).toBe(true)
    expect(isSidebarItemType(createNote(), SIDEBAR_ITEM_TYPES.folders)).toBe(false)
    expect(isSidebarItemType(null, SIDEBAR_ITEM_TYPES.notes)).toBe(false)
    expect(isSidebarItemType(undefined, SIDEBAR_ITEM_TYPES.notes)).toBe(false)
  })
})

describe('getSidebarItemAs', () => {
  it('returns item when type matches', () => {
    const note = createNote()
    expect(getSidebarItemAs(note, SIDEBAR_ITEM_TYPES.notes)).toBe(note)
  })

  it('returns undefined when type does not match', () => {
    const note = createNote()
    expect(getSidebarItemAs(note, SIDEBAR_ITEM_TYPES.folders)).toBeUndefined()
  })

  it('returns undefined for null/undefined', () => {
    expect(getSidebarItemAs(null, SIDEBAR_ITEM_TYPES.notes)).toBeUndefined()
    expect(getSidebarItemAs(undefined, SIDEBAR_ITEM_TYPES.notes)).toBeUndefined()
  })
})

describe('getSlug', () => {
  it('returns item slug from search params', () => {
    expect(getSlug({ item: assertSidebarItemSlug('my-note') })).toBe('my-note')
  })

  it('returns null when item is undefined', () => {
    expect(getSlug({})).toBeNull()
  })
})

describe('getDefaultIconName', () => {
  it('returns correct icon names for each type', () => {
    expect(getDefaultIconName(SIDEBAR_ITEM_TYPES.notes)).toBe('FileText')
    expect(getDefaultIconName(SIDEBAR_ITEM_TYPES.folders)).toBe('Folder')
    expect(getDefaultIconName(SIDEBAR_ITEM_TYPES.gameMaps)).toBe('MapPin')
    expect(getDefaultIconName(SIDEBAR_ITEM_TYPES.files)).toBe('File')
    expect(getDefaultIconName(SIDEBAR_ITEM_TYPES.canvases)).toBe('Grid2x2Plus')
  })
})

describe('getItemTypeLabel', () => {
  it('maps types to correct labels', () => {
    expect(getItemTypeLabel(SIDEBAR_ITEM_TYPES.notes)).toBe('Note')
    expect(getItemTypeLabel(SIDEBAR_ITEM_TYPES.folders)).toBe('Folder')
    expect(getItemTypeLabel(SIDEBAR_ITEM_TYPES.gameMaps)).toBe('Map')
    expect(getItemTypeLabel(SIDEBAR_ITEM_TYPES.files)).toBe('File')
  })
})

describe('isValidSidebarItemColor', () => {
  it('accepts valid 6-digit hex colors', () => {
    expect(isValidSidebarItemColor('#FF0000')).toBe(true)
    expect(isValidSidebarItemColor('#14b8a6')).toBe(true)
  })

  it('accepts valid 8-digit hex colors', () => {
    expect(isValidSidebarItemColor('#FF000080')).toBe(true)
  })

  it('rejects invalid colors', () => {
    expect(isValidSidebarItemColor('#FFF')).toBe(false)
    expect(isValidSidebarItemColor('red')).toBe(false)
    expect(isValidSidebarItemColor('')).toBe(false)
    expect(isValidSidebarItemColor(null)).toBe(false)
    expect(isValidSidebarItemColor(undefined)).toBe(false)
  })

  it('rejects hex without # prefix', () => {
    expect(isValidSidebarItemColor('FF0000')).toBe(false)
  })

  it('rejects 5-digit and 7-digit hex', () => {
    expect(isValidSidebarItemColor('#12345')).toBe(false)
    expect(isValidSidebarItemColor('#1234567')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(isValidSidebarItemColor('#GGGGGG')).toBe(false)
    expect(isValidSidebarItemColor('#ZZZZZZ')).toBe(false)
  })
})

describe('normalizeSidebarItemColorOrDefault', () => {
  it('returns color when valid', () => {
    expect(normalizeSidebarItemColorOrDefault('#FF0000')).toBe('#ff0000')
  })

  it('returns default when invalid', () => {
    expect(normalizeSidebarItemColorOrDefault('invalid')).toBe(DEFAULT_SIDEBAR_ITEM_COLOR)
  })

  it('returns default when null/undefined', () => {
    expect(normalizeSidebarItemColorOrDefault(null)).toBe(DEFAULT_SIDEBAR_ITEM_COLOR)
    expect(normalizeSidebarItemColorOrDefault(undefined)).toBe(DEFAULT_SIDEBAR_ITEM_COLOR)
  })

  it('uses custom default', () => {
    expect(normalizeSidebarItemColorOrDefault(null, '#000000')).toBe('#000000')
  })
})

describe('buildBreadcrumbs', () => {
  function buildMap(items: Array<AnySidebarItem>) {
    const map = new Map<Id<'sidebarItems'>, AnySidebarItem>()
    for (const item of items) map.set(item._id, item)
    return map
  }

  it('returns empty string for root items', () => {
    const note = createNote({ parentId: null })
    expect(buildBreadcrumbs(note, buildMap([note]))).toBe('')
  })

  it('builds correct path for nested items', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_bc1'),
      name: 'Parent',
      parentId: null,
    })
    const note = createNote({ parentId: folder._id })
    expect(buildBreadcrumbs(note, buildMap([folder, note]))).toBe('Parent/')
  })

  it('builds correct path for deeply nested items', () => {
    const gp = createFolder({
      _id: testId<'sidebarItems'>('folder_bc_gp'),
      name: 'Grandparent',
      parentId: null,
    })
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_bc_p'),
      name: 'Parent',
      parentId: gp._id,
    })
    const note = createNote({ parentId: parent._id })
    expect(buildBreadcrumbs(note, buildMap([gp, parent, note]))).toBe('Grandparent/Parent/')
  })

  it('stops at missing parent (orphaned parentId)', () => {
    const note = createNote({
      parentId: testId<'sidebarItems'>('folder_missing'),
    })
    expect(buildBreadcrumbs(note, buildMap([note]))).toBe('')
  })
})
