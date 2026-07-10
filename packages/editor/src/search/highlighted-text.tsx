import type { ReactNode } from 'react'
import { getHighlightRanges } from './highlight'

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const ranges = getHighlightRanges(text, query)
  if (ranges.length === 0) return <>{text}</>

  const segments: Array<ReactNode> = []
  let cursor = 0

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push(
        <span key={`t-${cursor}-${range.start}`}>{text.slice(cursor, range.start)}</span>,
      )
    }
    segments.push(
      <mark
        key={`m-${range.start}-${range.end}`}
        className="bg-primary/20 text-foreground rounded-sm"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    )
    cursor = range.end
  }

  if (cursor < text.length) {
    segments.push(<span key="tail">{text.slice(cursor)}</span>)
  }

  return <>{segments}</>
}
