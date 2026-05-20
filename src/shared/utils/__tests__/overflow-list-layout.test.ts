import { describe, expect, it } from 'vitest'
import { getOverflowListLayout } from '../overflow-list-layout'

describe('getOverflowListLayout', () => {
  it('shows every item when they fit without an overflow item', () => {
    expect(
      getOverflowListLayout({
        containerWidth: 180,
        gapWidth: 4,
        itemWidths: [40, 50, 60],
        getOverflowItemWidth: () => 64,
      }),
    ).toEqual({ visibleCount: 3, hiddenCount: 0 })
  })

  it('reserves room for the overflow item as the last visible item', () => {
    expect(
      getOverflowListLayout({
        containerWidth: 160,
        gapWidth: 4,
        itemWidths: [50, 50, 50, 50],
        getOverflowItemWidth: () => 48,
      }),
    ).toEqual({ visibleCount: 2, hiddenCount: 2 })
  })

  it('uses the overflow width for the actual hidden count', () => {
    expect(
      getOverflowListLayout({
        containerWidth: 132,
        gapWidth: 4,
        itemWidths: [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
        getOverflowItemWidth: (hiddenCount) => (hiddenCount >= 10 ? 64 : 48),
      }),
    ).toEqual({ visibleCount: 1, hiddenCount: 10 })
  })

  it('falls back to only the overflow item when no list item can fit beside it', () => {
    expect(
      getOverflowListLayout({
        containerWidth: 90,
        gapWidth: 4,
        itemWidths: [80, 80, 80],
        getOverflowItemWidth: () => 56,
      }),
    ).toEqual({ visibleCount: 0, hiddenCount: 3 })
  })
})
