import type { CustomBlock, InlineContent } from '../../convex/blocks/types'
import type { NoteValueAuthoringDefinition } from './types'

function extractFromInlineContent<TNoteId>(
  content: InlineContent,
  noteId: TNoteId,
  blockNoteId: string,
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
) {
  for (const item of content) {
    if (item.type === 'value') {
      definitions.push({
        noteId,
        blockNoteId,
        valueId: item.props.valueId,
        slug: item.props.slug,
        expressionSource: item.props.expressionSource,
      })
    }
  }
}

function extractFromBlockContent<TNoteId>(
  block: CustomBlock,
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
  blocks: Array<CustomBlock>,
  noteId: TNoteId,
): Array<NoteValueAuthoringDefinition<TNoteId>> {
  const definitions: Array<NoteValueAuthoringDefinition<TNoteId>> = []

  const visit = (block: CustomBlock) => {
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
