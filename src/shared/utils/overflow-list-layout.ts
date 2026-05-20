interface OverflowListLayout {
  visibleCount: number
  hiddenCount: number
}

export function getOverflowListLayout({
  containerWidth,
  gapWidth,
  itemWidths,
  getOverflowItemWidth,
}: {
  containerWidth: number
  gapWidth: number
  itemWidths: Array<number>
  getOverflowItemWidth: (hiddenCount: number) => number
}): OverflowListLayout {
  const itemCount = itemWidths.length
  if (itemCount === 0) {
    return { visibleCount: 0, hiddenCount: 0 }
  }

  const safeContainerWidth = Math.max(0, containerWidth)
  const safeGapWidth = Math.max(0, gapWidth)
  const prefixWidths = getPrefixWidths(itemWidths)

  for (let visibleCount = itemCount; visibleCount >= 0; visibleCount--) {
    const hiddenCount = itemCount - visibleCount
    const visibleItemsWidth = prefixWidths[visibleCount] ?? 0
    const visibleGapsWidth = Math.max(0, visibleCount - 1) * safeGapWidth
    const overflowItemWidth = hiddenCount > 0 ? Math.max(0, getOverflowItemWidth(hiddenCount)) : 0
    const overflowGapWidth = visibleCount > 0 && hiddenCount > 0 ? safeGapWidth : 0
    const totalWidth = visibleItemsWidth + visibleGapsWidth + overflowGapWidth + overflowItemWidth

    if (totalWidth <= safeContainerWidth) {
      return { visibleCount, hiddenCount }
    }
  }

  return { visibleCount: 0, hiddenCount: itemCount }
}

function getPrefixWidths(itemWidths: Array<number>) {
  const prefixWidths = [0]
  for (const itemWidth of itemWidths) {
    prefixWidths.push((prefixWidths.at(-1) ?? 0) + Math.max(0, itemWidth))
  }
  return prefixWidths
}
