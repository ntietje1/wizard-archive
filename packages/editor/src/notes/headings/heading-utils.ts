import { headingPropsSchema } from '../document/model'
import type { NoteBlock, Heading, InlineContent } from '../document/model'

function extractText(content: InlineContent | undefined): string {
  if (!content) return ''
  return content.map((item) => (item.type === 'text' ? item.text : item.props.slug)).join('')
}

function normalizeHeadingText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function extractHeadingsFromContent(content: Array<NoteBlock>): Array<Heading> {
  const headings: Array<Heading> = []

  const process = (block: NoteBlock) => {
    if (block.type === 'heading') {
      const text = extractText(Array.isArray(block.content) ? block.content : undefined)
      if (text) {
        const props = headingPropsSchema.safeParse(block.props)
        if (props.success) {
          headings.push({
            noteBlockId: block.id,
            text,
            level: props.data.level,
            normalizedText: normalizeHeadingText(text),
          })
        }
      }
    }
    block.children?.forEach((child: NoteBlock) => process(child))
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

  let candidates = headings
  let result: Heading | undefined

  for (const text of path) {
    const normalized = normalizeHeadingText(text)
    const idx = candidates.findIndex((heading) => heading.normalizedText === normalized)
    if (idx === -1) return undefined
    result = candidates[idx]
    candidates = getChildHeadings(candidates, result.level, idx + 1)
  }

  return result
}

function getChildHeadings(
  headings: Array<Heading>,
  parentLevel: number,
  startIdx: number,
): Array<Heading> {
  const children: Array<Heading> = []
  for (let idx = startIdx; idx < headings.length; idx++) {
    const heading = headings[idx]
    if (heading.level <= parentLevel) break
    children.push(heading)
  }
  return children
}
