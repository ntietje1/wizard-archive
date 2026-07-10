import type {
  NoteBlockContent,
  InlineContent,
  TableContent,
} from '@wizard-archive/editor/notes/document-contract'

function collectTexts(items: Array<string>): string {
  return items.join(' ')
}

function collectInlineTexts(items: InlineContent): Array<string> {
  const texts: Array<string> = []
  for (const item of items) {
    if (item.type === 'text') {
      texts.push(item.text)
    }
  }
  return texts
}

function collectTableTexts(rows: TableContent['rows']): Array<string> {
  const texts: Array<string> = []
  for (const row of rows) {
    for (const cell of row.cells) {
      texts.push(...collectInlineTexts(cell.content))
    }
  }
  return texts
}

export function extractPlainText(block: NoteBlockContent): string {
  const content = block.content
  if (!content) return ''

  if (Array.isArray(content)) {
    return collectTexts(collectInlineTexts(content))
  }

  if (content.type === 'tableContent') {
    return collectTexts(collectTableTexts(content.rows))
  }

  return ''
}
