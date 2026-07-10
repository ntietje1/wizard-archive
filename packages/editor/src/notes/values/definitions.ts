import type { InlineContent, NoteBlock } from '../document/model'
import type { NoteValueAuthoringDefinition } from './runtime'

function extractFromInlineContent<TNoteId>(
  content: InlineContent,
  noteId: TNoteId,
  noteBlockId: string,
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
) {
  for (const item of content) {
    if (item.type === 'value') {
      definitions.push({
        noteId,
        noteBlockId,
        valueId: item.props.valueId,
        slug: item.props.slug,
        expressionSource: item.props.expressionSource,
      })
    }
  }
}

function extractFromBlockContent<TNoteId>(
  block: NoteBlock,
  noteId: TNoteId,
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
) {
  if (Array.isArray(block.content)) {
    extractFromInlineContent(block.content, noteId, block.id, definitions)
    return
  }

  if (block.content?.type !== 'tableContent') {
    return
  }

  for (const row of block.content.rows) {
    for (const cell of row.cells) {
      extractFromInlineContent(cell.content, noteId, block.id, definitions)
    }
  }
}

export function extractNoteValueDefinitions<TNoteId>(
  blocks: Array<NoteBlock>,
  noteId: TNoteId,
): Array<NoteValueAuthoringDefinition<TNoteId>> {
  const definitions: Array<NoteValueAuthoringDefinition<TNoteId>> = []

  const visit = (block: NoteBlock) => {
    extractFromBlockContent(block, noteId, definitions)

    for (const child of block.children ?? []) {
      visit(child)
    }
  }

  for (const block of blocks) {
    visit(block)
  }

  return definitions
}
