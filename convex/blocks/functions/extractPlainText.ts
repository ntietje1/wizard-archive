import type { FlatBlockContent } from '../types'

function collectTexts(items: Array<{ text?: string }>): string {
  const texts: Array<string> = []
  for (const item of items) {
    if (item.text !== undefined) texts.push(item.text)
  }
  return texts.join(' ')
}

export function extractPlainText(block: FlatBlockContent): string {
  const content = block.content
  if (!content) return ''

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

  return ''
}
