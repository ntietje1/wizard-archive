import { describe, expect, it } from 'vitest'
import {
  getSidebarItemVisualState,
  sidebarItemBackgroundClass,
  sidebarItemActionButtonClass,
  sidebarItemActionGroupClass,
  sidebarItemFolderFillClass,
  sidebarItemHoverFillClass,
  sidebarItemHoverOverlayClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '../sidebar-item-visual-state'
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

  it('uses purple for selected backgrounds unless the viewed item is the only selection', () => {
    expect(
      sidebarItemBackgroundClass({
        isSelected: true,
        isViewing: false,
        isMultiSelected: false,
      }),
    ).toBe('bg-primary/12 hover:bg-primary/16 dark:bg-primary/20 dark:hover:bg-primary/28')
    expect(
      sidebarItemBackgroundClass({
        isSelected: true,
        isViewing: true,
        isMultiSelected: false,
      }),
    ).toBe('bg-muted-foreground/10 dark:bg-muted/70')
    expect(
      sidebarItemBackgroundClass({
        isSelected: true,
        isViewing: true,
        isMultiSelected: true,
      }),
    ).toBe('bg-primary/18 dark:bg-primary/30')
    expect(
      sidebarItemBackgroundClass({
        isSelected: false,
        isViewing: true,
        isMultiSelected: false,
      }),
    ).toBe('bg-muted-foreground/10 dark:bg-muted/70')
    expect(
      sidebarItemBackgroundClass({
        isSelected: false,
        isViewing: false,
        isMultiSelected: false,
      }),
    ).toBe('hover:bg-muted-foreground/6 dark:hover:bg-muted/50')
  })

  it('dims cut item backgrounds without changing their selection color rule', () => {
    expect(
      sidebarItemBackgroundClass({
        isSelected: true,
        isViewing: false,
        isMultiSelected: false,
        isCut: true,
      }),
    ).toBe(
      'bg-primary/12 hover:bg-primary/16 dark:bg-primary/20 dark:hover:bg-primary/28 opacity-60',
    )
    expect(
      sidebarItemBackgroundClass({
        isSelected: false,
        isViewing: true,
        isMultiSelected: false,
        isCut: true,
      }),
    ).toBe('bg-muted-foreground/10 dark:bg-muted/70 opacity-60')
  })

  it.each([
    ['name', sidebarItemNameClass],
    ['icon', sidebarItemIconClass],
    ['action button', sidebarItemActionButtonClass],
  ] as const)('keeps %s colors muted until hover or viewing', (_label, classForState) => {
    expect(classForState({ isSelected: true, isViewing: false, isMultiSelected: false })).toBe(
      'text-foreground/70 group-hover:text-foreground/90',
    )
    expect(classForState({ isSelected: false, isViewing: true, isMultiSelected: false })).toBe(
      'text-foreground',
    )
    expect(classForState({ isSelected: true, isViewing: true, isMultiSelected: false })).toBe(
      'text-foreground',
    )
    expect(classForState({ isSelected: false, isViewing: false, isMultiSelected: false })).toBe(
      'text-foreground/70 group-hover:text-foreground/90',
    )
  })

  it('reveals action buttons on hover or while the share popover is open, not focus', () => {
    expect(sidebarItemActionGroupClass).toBe(
      'flex items-center shrink-0 w-0 overflow-hidden opacity-0 pointer-events-none group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 group-hover:pointer-events-auto has-[[data-share-open]]:w-auto has-[[data-share-open]]:overflow-visible has-[[data-share-open]]:opacity-100 has-[[data-share-open]]:pointer-events-auto',
    )
    expect(sidebarItemActionGroupClass).not.toContain('group-focus-within')
  })

  it('does not stack hover overlays onto viewed items', () => {
    expect(
      sidebarItemHoverOverlayClass({
        isSelected: true,
        isViewing: true,
        isMultiSelected: false,
      }),
    ).toBe('opacity-0')
    expect(
      sidebarItemHoverOverlayClass({
        isSelected: true,
        isViewing: false,
        isMultiSelected: false,
      }),
    ).toBe('opacity-0 group-hover:opacity-100')
  })

  it('uses matching fill colors for folder cards', () => {
    expect(
      sidebarItemFolderFillClass({
        isSelected: false,
        isViewing: true,
        isMultiSelected: false,
      }),
    ).toBe('fill-muted-foreground/10 dark:fill-muted/70')
    expect(
      sidebarItemFolderFillClass({
        isSelected: true,
        isViewing: false,
        isMultiSelected: false,
      }),
    ).toBe('fill-primary/12 dark:fill-primary/20')
    expect(
      sidebarItemFolderFillClass({
        isSelected: true,
        isViewing: true,
        isMultiSelected: false,
      }),
    ).toBe('fill-muted-foreground/10 dark:fill-muted/70')
    expect(
      sidebarItemFolderFillClass({
        isSelected: true,
        isViewing: true,
        isMultiSelected: true,
      }),
    ).toBe('fill-primary/18 dark:fill-primary/30')
    expect(
      sidebarItemHoverFillClass({ isSelected: false, isViewing: false, isMultiSelected: false }),
    ).toBe('fill-muted-foreground/6 dark:fill-muted/50')
    expect(
      sidebarItemHoverFillClass({ isSelected: true, isViewing: false, isMultiSelected: false }),
    ).toBe('fill-primary/16 dark:fill-primary/28')
  })

  it('uses fallback classes for omitted visual flags', () => {
    expect(sidebarItemBackgroundClass()).toContain('hover:bg-muted-foreground')
    expect(sidebarItemNameClass()).toBe('text-foreground/70 group-hover:text-foreground/90')
    expect(sidebarItemIconClass()).toBe('text-foreground/70 group-hover:text-foreground/90')
    expect(sidebarItemActionButtonClass()).toBe('text-foreground/70 group-hover:text-foreground/90')
    expect(sidebarItemHoverOverlayClass()).toBe('opacity-0 group-hover:opacity-100')
    expect(sidebarItemFolderFillClass()).toBe('fill-card')
    expect(sidebarItemHoverFillClass()).toContain('fill-muted-foreground')
  })
})
