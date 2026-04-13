import type { BlockNoteId } from 'convex/blocks/types'
import type { CustomBlock } from 'convex/notes/editorSpecs'

export interface HeadingEntry {
  blockNoteId: BlockNoteId
  text: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  normalizedText: string
}

function isTextNode(item: unknown): item is { type: 'text'; text?: string } {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'text'
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter(isTextNode)
    .map((c) => c.text ?? '')
    .join('')
}

export function normalizeHeadingText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function extractHeadingsFromContent(content: Array<CustomBlock>): Array<HeadingEntry> {
  const headings: Array<HeadingEntry> = []

  const process = (block: CustomBlock) => {
    if (block.type === 'heading') {
      const text = extractText(block.content)
      if (text) {
        const level = (block.props as { level?: number })?.level
        headings.push({
          blockNoteId: block.id,
          text,
          level: level === 1 || level === 2 || level === 3 ? level : 1,
          normalizedText: normalizeHeadingText(text),
        })
      }
    }
    block.children?.forEach((c) => process(c))
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
    const idx = headings.findIndex((h, i) => i >= startIdx && h.normalizedText === normalized)
    if (idx === -1) return undefined
    result = headings[idx]
    startIdx = idx + 1
  }

  return result
}
