import { describe, expect, it } from 'vitest'
import { getSidebarItemVisualState } from '../sidebar-item-visual-state'
import { createNote } from '~/test/factories/sidebar-item-factory'

describe('sidebar item visual state utilities', () => {
  it('keeps selection separate from the currently viewed item', () => {
    const viewed = createNote()
    const selected = createNote()

    expect(
      getSidebarItemVisualState({
        item: viewed,
        selectedItemIds: [selected._id],
        selectedSlug: viewed.slug,
      }),
    ).toEqual({ isSelected: false, isViewing: true, isMultiSelected: false, isCut: false })
  })

  it('marks the viewed item selected without treating a single selection as multi-selected', () => {
    const item = createNote()

    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: [item._id],
        selectedSlug: item.slug,
      }),
    ).toEqual({ isSelected: true, isViewing: true, isMultiSelected: false, isCut: false })
  })

  it('marks the viewed item multi-selected when another item is selected too', () => {
    const viewed = createNote()
    const selected = createNote()

    expect(
      getSidebarItemVisualState({
        item: viewed,
        selectedItemIds: [viewed._id, selected._id],
        selectedSlug: viewed.slug,
      }),
    ).toEqual({ isSelected: true, isViewing: true, isMultiSelected: true, isCut: false })
  })

  it('does not treat route selection as item selection', () => {
    const item = createNote()

    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: [],
        selectedSlug: item.slug,
      }),
    ).toEqual({ isSelected: false, isViewing: true, isMultiSelected: false, isCut: false })
  })

  it('uses safe defaults when selection inputs are missing', () => {
    const item = createNote()

    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: undefined,
        selectedSlug: undefined,
      }),
    ).toEqual({ isSelected: false, isViewing: false, isMultiSelected: false, isCut: false })
    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: null,
        selectedSlug: null,
      }),
    ).toEqual({ isSelected: false, isViewing: false, isMultiSelected: false, isCut: false })
    expect(
      getSidebarItemVisualState({
        item,
        selectedItemIds: [],
        selectedSlug: undefined,
      }),
    ).toEqual({ isSelected: false, isViewing: false, isMultiSelected: false, isCut: false })
  })

  it('marks items that are in the cut clipboard', () => {
    const cutItem = createNote()
    const otherItem = createNote()

    expect(
      getSidebarItemVisualState({
        item: cutItem,
        selectedItemIds: [],
        selectedSlug: null,
        cutItemIds: [cutItem._id],
      }),
    ).toEqual({ isSelected: false, isViewing: false, isMultiSelected: false, isCut: true })
    expect(
      getSidebarItemVisualState({
        item: otherItem,
        selectedItemIds: [],
        selectedSlug: null,
        cutItemIds: [cutItem._id],
      }),
    ).toEqual({ isSelected: false, isViewing: false, isMultiSelected: false, isCut: false })
  })
})
