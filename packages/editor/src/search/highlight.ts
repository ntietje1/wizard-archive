interface HighlightRange {
  start: number
  end: number
}

export function getHighlightRanges(text: string, query: string): Array<HighlightRange> {
  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const ranges: Array<HighlightRange> = []
  const lowerTextParts: Array<string> = []
  const lowerOffsetMap: Array<{ start: number; end: number }> = []
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index)
    const codePointLength = codePoint && codePoint > 0xffff ? 2 : 1
    const originalEnd = index + codePointLength
    const lowerPart = text.slice(index, originalEnd).toLowerCase()
    lowerTextParts.push(lowerPart)
    for (const _character of lowerPart) {
      lowerOffsetMap.push({ start: index, end: originalEnd })
    }
    index = originalEnd
  }
  const lowerText = lowerTextParts.join('')

  for (const term of terms) {
    const lowerTerm = term.toLowerCase()
    let start = 0
    while (start < lowerText.length) {
      const idx = lowerText.indexOf(lowerTerm, start)
      if (idx === -1) break
      const matchEnd = idx + lowerTerm.length - 1
      const startOffset = lowerOffsetMap[idx]
      const endOffset = lowerOffsetMap[matchEnd]
      if (startOffset && endOffset) {
        ranges.push({ start: startOffset.start, end: endOffset.end })
      }
      start = idx + 1
    }
  }

  if (ranges.length === 0) return []

  ranges.sort((a, b) => a.start - b.start || a.end - b.end)

  const merged: Array<HighlightRange> = [ranges[0]]
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = ranges[i]
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end)
    } else {
      merged.push(curr)
    }
  }

  return merged
}
