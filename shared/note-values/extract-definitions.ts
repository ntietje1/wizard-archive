import type { NoteValueAuthoringDefinition, NoteValueProps } from './types'

type ValueInlineContent = {
  type: 'value'
  props: NoteValueProps
}

type InlineContent = ValueInlineContent | { type: string; props?: unknown }

type TableCell = Array<InlineContent> | { content: Array<InlineContent> }

type BlockWithValueContent = {
  id: string
  content?:
    | Array<InlineContent>
    | { type: 'tableContent'; rows: Array<{ cells: Array<TableCell> }> }
  children?: Array<BlockWithValueContent>
}

function isValueInlineContent(content: InlineContent): content is ValueInlineContent {
  return content.type === 'value'
}

function extractFromInlineContent<TNoteId>(
  content: Array<InlineContent>,
  noteId: TNoteId,
  blockNoteId: string,
  definitions: Array<NoteValueAuthoringDefinition<TNoteId>>,
) {
  for (const item of content) {
    if (isValueInlineContent(item)) {
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
  block: BlockWithValueContent,
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
      extractFromInlineContent(
        Array.isArray(cell) ? cell : cell.content,
        noteId,
        block.id,
        definitions,
      )
    }
  }
}

export function extractNoteValueDefinitions<TNoteId>(
  blocks: Array<BlockWithValueContent>,
  noteId: TNoteId,
): Array<NoteValueAuthoringDefinition<TNoteId>> {
  const definitions: Array<NoteValueAuthoringDefinition<TNoteId>> = []

  const visit = (block: BlockWithValueContent) => {
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
