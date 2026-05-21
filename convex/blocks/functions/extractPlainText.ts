import type { FlatBlockContent } from '../types'

function collectTexts(items: Array<{ text?: string }>): string {
  const texts: Array<string> = []
  for (const item of items) {
    if (item.text !== undefined) texts.push(item.text)
  }
  return texts.join(' ')
}

function isTextInlineContent(item: unknown): item is { text: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    item.type === 'text' &&
    'text' in item &&
    typeof item.text === 'string'
  )
}

function collectInlineTextItems(items: Array<unknown>): Array<{ text?: string }> {
  const texts: Array<{ text?: string }> = []
  for (const item of items) {
    if (isTextInlineContent(item)) {
      texts.push(item)
    }
  }
  return texts
}

function collectTableTextItems(
  rows: Array<{ cells: Array<Array<unknown> | { content?: Array<unknown> }> }>,
): Array<{ text?: string }> {
  const texts: Array<{ text?: string }> = []
  for (const row of rows) {
    for (const cell of row.cells) {
      texts.push(...collectInlineTextItems(Array.isArray(cell) ? cell : (cell.content ?? [])))
    }
  }
  return texts
}

export function extractPlainText(block: FlatBlockContent): string {
  const content = 'content' in block ? block.content : undefined
  if (!content) return ''

  if ('type' in content && content.type === 'tableContent') {
    return collectTexts(collectTableTextItems(content.rows))
  }

  if (Array.isArray(content)) {
    return collectTexts(collectInlineTextItems(content))
  }

  return ''
}
