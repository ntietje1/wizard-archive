import { headingPropsSchema } from 'shared/editor-blocks/blockSchemas'
import type { CustomBlock, Heading, InlineContent } from 'shared/editor-blocks/types'

function extractText(content: InlineContent | undefined): string {
  if (!content) return ''
  return content
    .filter((item) => item.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
}

function normalizeHeadingText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function extractHeadingsFromContent(content: Array<CustomBlock>): Array<Heading> {
  const headings: Array<Heading> = []

  const process = (block: CustomBlock) => {
    if (block.type === 'heading') {
      const text = extractText(Array.isArray(block.content) ? block.content : undefined)
      if (text) {
        const props = headingPropsSchema.safeParse(block.props)
        if (!props.success) return
        headings.push({
          blockNoteId: block.id,
          text,
          level: props.data.level,
          normalizedText: normalizeHeadingText(text),
        })
      }
    }
    block.children?.forEach((c) => process(c))
  }

  content.forEach(process)
  return headings
}

/** Resolve chained heading path (e.g., H1#H2) to final heading */
export function resolveHeadingPath(
  headings: Array<Heading>,
  path: Array<string>,
): Heading | undefined {
  if (path.length === 0) return undefined

  let startIdx = 0
  let result: Heading | undefined

  for (const text of path) {
    const normalized = normalizeHeadingText(text)
    const idx = headings.findIndex((h, i) => i >= startIdx && h.normalizedText === normalized)
    if (idx === -1) return undefined
    result = headings[idx]
    startIdx = idx + 1
  }

  return result
}
