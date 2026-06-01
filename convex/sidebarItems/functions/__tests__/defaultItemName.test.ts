import { describe, expect, it } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from '../../../../shared/sidebar-items/types'
import {
  deduplicateName,
  findUniqueDefaultName,
} from '../../../../shared/sidebar-items/default-name'
import { assertSidebarItemName } from '../../validation/name'

describe('deduplicateName', () => {
  it('uses base, then base 1, base 2, and so on', () => {
    expect(deduplicateName('Scene', [])).toBe('Scene')
    expect(deduplicateName('Scene', ['Scene'])).toBe('Scene 1')
    expect(deduplicateName('Scene', ['Scene', 'Scene 1'])).toBe('Scene 2')
    expect(deduplicateName('Scene', ['Scene', 'Scene 2'])).toBe('Scene 1')
  })

  it('does not append numeric suffixes to generated numeric suffixes', () => {
    expect(
      deduplicateName('Untitled Note 2 3 3 2', [
        'Untitled Note',
        'Untitled Note 1',
        'Untitled Note 2',
        'Untitled Note 2 3 3 2',
      ]),
    ).toBe('Untitled Note 3')
  })

  it('collapses chained numeric suffixes even if the clean base is available', () => {
    expect(deduplicateName('Untitled Note 2 3 3 2', ['Untitled Note 2 3 3 2'])).toBe(
      'Untitled Note',
    )
  })

  it('preserves user-authored trailing numbers that are not part of an existing suffix sequence', () => {
    expect(deduplicateName('Scene 1778718519495', ['Scene 1778718519495'])).toBe(
      'Scene 1778718519495 1',
    )
  })

  it('compares sibling names case-insensitively', () => {
    expect(deduplicateName('Scene', ['scene', 'SCENE 1'])).toBe('Scene 2')
  })
})

describe('findUniqueDefaultName', () => {
  it('uses the same suffix sequence for default item names', () => {
    expect(
      findUniqueDefaultName(SIDEBAR_ITEM_TYPES.notes, [
        { name: assertSidebarItemName('Untitled Note') },
      ]),
    ).toBe('Untitled Note 1')
  })

  it('uses type-specific default names', () => {
    expect(findUniqueDefaultName(SIDEBAR_ITEM_TYPES.folders, [])).toBe('Untitled Folder')
    expect(findUniqueDefaultName(SIDEBAR_ITEM_TYPES.gameMaps, [])).toBe('Untitled Map')
    expect(findUniqueDefaultName(SIDEBAR_ITEM_TYPES.files, [])).toBe('Untitled File')
    expect(findUniqueDefaultName(SIDEBAR_ITEM_TYPES.canvases, [])).toBe('Untitled Canvas')
  })

  it('fills gaps in default name suffixes', () => {
    expect(
      findUniqueDefaultName(SIDEBAR_ITEM_TYPES.notes, [
        { name: assertSidebarItemName('Untitled Note') },
        { name: assertSidebarItemName('Untitled Note 1') },
        { name: assertSidebarItemName('Untitled Note 3') },
      ]),
    ).toBe('Untitled Note 2')
  })

  it('matches default names case-insensitively', () => {
    expect(
      findUniqueDefaultName(SIDEBAR_ITEM_TYPES.notes, [
        { name: assertSidebarItemName('untitled note') },
        { name: assertSidebarItemName('Untitled NOTE 1') },
      ]),
    ).toBe('Untitled Note 2')
  })
})
