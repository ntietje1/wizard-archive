export interface HighlightRange {
  start: number
  end: number
}

export function getHighlightRanges(text: string, query: string): Array<HighlightRange> {
  const terms = query.split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const ranges: Array<HighlightRange> = []
  const lowerText = text.toLowerCase()

  for (const term of terms) {
    const lowerTerm = term.toLowerCase()
    let start = 0
    while (start < lowerText.length) {
      const idx = lowerText.indexOf(lowerTerm, start)
      if (idx === -1) break
      ranges.push({ start: idx, end: idx + lowerTerm.length })
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
