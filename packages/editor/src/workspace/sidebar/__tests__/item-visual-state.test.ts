import { describe, expect, it } from 'vite-plus/test'
import { createNote } from '../../../test/sidebar-item-factory'
import {
  getSidebarItemVisualState,
  sidebarItemActionButtonClass,
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '../item-visual-state'

describe('sidebar item visual state utilities', () => {
  it('marks the viewed item selected', () => {
    const item = createNote()

    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: [item.id],
        currentItemId: item.id,
      }),
    ).toEqual({
      isSelected: true,
      isViewing: true,
      isMultiSelected: false,
      isCut: false,
    })
  })

  it('marks the viewed item multi-selected when another item is selected too', () => {
    const viewed = createNote()
    const selected = createNote()

    expect(
      getSidebarItemVisualState({
        item: viewed,
        selectedItemIds: [viewed.id, selected.id],
        currentItemId: viewed.id,
      }),
    ).toMatchObject({ isSelected: true, isViewing: true, isMultiSelected: true })
  })

  it('marks items that are in the cut clipboard', () => {
    const cutItem = createNote()

    expect(
      getSidebarItemVisualState({
        item: cutItem,
        selectedItemIds: [],
        currentItemId: null,
        cutItemIds: [cutItem.id],
      }),
    ).toMatchObject({ isCut: true })
  })

  it('prioritizes viewing plus multi-selection background state', () => {
    expect(
      sidebarItemBackgroundClass({
        isViewing: true,
        isSelected: true,
        isMultiSelected: true,
      }),
    ).toBe('bg-item-viewing group-focus-within/sidebar-surface:bg-item-selected-focus')
  })

  it('uses the viewing background before plain selection background', () => {
    expect(sidebarItemBackgroundClass({ isViewing: true, isSelected: true })).toBe(
      'bg-item-viewing',
    )
  })

  it('uses the selected background for selected non-viewed items', () => {
    expect(sidebarItemBackgroundClass({ isSelected: true })).toBe(
      'bg-item-selected hover:bg-item-selected-hover group-focus-within/sidebar-surface:bg-item-selected-focus group-focus-within/sidebar-surface:hover:bg-item-selected-focus-hover',
    )
  })

  it('uses the default hover background for unselected non-viewed items', () => {
    expect(sidebarItemBackgroundClass()).toBe('hover:bg-item-hover')
  })

  it('dims background classes for cut items', () => {
    expect(sidebarItemBackgroundClass({ isCut: true })).toBe('hover:bg-item-hover opacity-60')
  })

  it('shares text styling across name, icon, and action helpers', () => {
    expect(sidebarItemNameClass({ isViewing: true })).toBe('text-foreground')
    expect(sidebarItemIconClass()).toBe('text-foreground/70 group-hover:text-foreground/90')
    expect(sidebarItemActionButtonClass({ isViewing: true })).toBe('text-foreground')
  })
})
