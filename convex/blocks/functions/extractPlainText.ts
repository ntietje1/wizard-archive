import type { FlatBlockContent } from '../types'

function collectTexts(items: Array<{ text?: string }>): string | null {
  const texts: Array<string> = []
  for (const item of items) {
    if (item.text !== undefined) texts.push(item.text)
  }
  return texts.length > 0 ? texts.join(' ') : null
}

export function extractPlainText(block: FlatBlockContent): string | null {
  const content = block.content
  if (!content) return null

  if ('type' in content && content.type === 'tableContent') {
    const items: Array<{ text?: string }> = []
    for (const row of content.rows) {
      for (const cell of row.cells) {
        for (const item of cell) {
          items.push(item)
        }
      }
    }
    return collectTexts(items)
  }

  if (Array.isArray(content)) {
    return collectTexts(content)
  }

  return null
}
