import type { FlatBlockContent } from '../flatBlockValidator'

export function extractPlainText(block: FlatBlockContent): string | null {
  const content = block.content
  if (!content) return null

  if ('type' in content && content.type === 'tableContent') {
    const texts: Array<string> = []
    for (const row of content.rows) {
      for (const cell of row.cells) {
        for (const item of cell) {
          if (item.text) texts.push(item.text)
        }
      }
    }
    return texts.length > 0 ? texts.join(' ') : null
  }

  if (Array.isArray(content)) {
    const texts: Array<string> = []
    for (const item of content) {
      if (item.text) texts.push(item.text)
    }
    return texts.length > 0 ? texts.join(' ') : null
  }

  return null
}
