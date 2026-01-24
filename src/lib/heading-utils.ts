import type { CustomPartialBlock } from './editor-schema'

export interface HeadingEntry {
  blockId: string
  text: string
  level: 1 | 2 | 3
  normalizedText: string
}

function extractText(
  content: Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content) return ''
  return content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text)
    .join('')
}

export function normalizeHeadingText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function extractHeadingsFromContent(
  content: Array<CustomPartialBlock>,
): Array<HeadingEntry> {
  const headings: Array<HeadingEntry> = []

  const process = (block: CustomPartialBlock) => {
    if (block.type === 'heading') {
      const text = extractText(
        block.content as Array<{ type: string; text?: string }>,
      )
      if (text) {
        const level = (block.props as { level?: number })?.level
        if (!block.id) return
        headings.push({
          blockId: block.id,
          text,
          level: level === 1 || level === 2 || level === 3 ? level : 1,
          normalizedText: normalizeHeadingText(text),
        })
      }
    }
    block.children?.forEach((c) => process(c as CustomPartialBlock))
  }

  content.forEach(process)
  return headings
}

export function findHeadingByText(
  headings: Array<HeadingEntry>,
  searchText: string,
): HeadingEntry | undefined {
  const normalized = normalizeHeadingText(searchText)
  return headings.find((h) => h.normalizedText === normalized)
}

/** Resolve chained heading path (e.g., H1#H2) to final heading */
export function resolveHeadingPath(
  headings: Array<HeadingEntry>,
  path: Array<string>,
): HeadingEntry | undefined {
  if (path.length === 0) return undefined

  let startIdx = 0
  let result: HeadingEntry | undefined

  for (const text of path) {
    const normalized = normalizeHeadingText(text)
    const idx = headings.findIndex(
      (h, i) => i >= startIdx && h.normalizedText === normalized,
    )
    if (idx === -1) return undefined
    result = headings[idx]
    startIdx = idx + 1
  }

  return result
}
