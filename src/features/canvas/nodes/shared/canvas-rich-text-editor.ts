import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from '@blocknote/core'
import type {
  Block,
  BlockNoteEditor,
  BlockSpecs,
  InlineContentSpecs,
  PartialBlock,
  StyleSpecs,
} from '@blocknote/core'

const {
  audio: _audio,
  divider: _divider,
  file: _file,
  image: _image,
  table: _table,
  toggleListItem: _toggleListItem,
  video: _video,
  ...canvasBlockSpecs
} = defaultBlockSpecs

const { link: _link, ...canvasInlineContentSpecs } = defaultInlineContentSpecs

export const canvasRichTextBlockSpecs = {
  ...canvasBlockSpecs,
} as BlockSpecs

export const canvasRichTextInlineContentSpecs = {
  ...canvasInlineContentSpecs,
} as InlineContentSpecs

export const canvasRichTextStyleSpecs = {
  ...defaultStyleSpecs,
} satisfies StyleSpecs

export const canvasRichTextEditorSchema = BlockNoteSchema.create({
  blockSpecs: canvasRichTextBlockSpecs,
  inlineContentSpecs: canvasRichTextInlineContentSpecs,
  styleSpecs: canvasRichTextStyleSpecs,
})

export type CanvasRichTextBlockSchema = typeof canvasRichTextEditorSchema.blockSchema
export type CanvasRichTextInlineContentSchema =
  typeof canvasRichTextEditorSchema.inlineContentSchema
export type CanvasRichTextStyleSchema = typeof canvasRichTextEditorSchema.styleSchema

export type CanvasRichTextBlock = Block<
  CanvasRichTextBlockSchema,
  CanvasRichTextInlineContentSchema,
  CanvasRichTextStyleSchema
>

export type CanvasRichTextPartialBlock = PartialBlock<
  CanvasRichTextBlockSchema,
  CanvasRichTextInlineContentSchema,
  CanvasRichTextStyleSchema
>

export type CanvasRichTextEditor = BlockNoteEditor<
  CanvasRichTextBlockSchema,
  CanvasRichTextInlineContentSchema,
  CanvasRichTextStyleSchema
>

const EMPTY_CANVAS_RICH_TEXT_CONTENT = [
  { type: 'paragraph' },
] satisfies Array<CanvasRichTextPartialBlock>

export function createEmptyCanvasRichTextContent(): Array<CanvasRichTextPartialBlock> {
  return cloneCanvasRichTextContent(EMPTY_CANVAS_RICH_TEXT_CONTENT)
}

export function normalizeCanvasRichTextContent(value: unknown): Array<CanvasRichTextPartialBlock> {
  if (!Array.isArray(value) || value.length === 0) {
    return createEmptyCanvasRichTextContent()
  }

  return cloneCanvasRichTextContent(value as Array<CanvasRichTextPartialBlock>)
}

export function cloneCanvasRichTextContent(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock>,
): Array<CanvasRichTextPartialBlock> {
  return JSON.parse(JSON.stringify(blocks)) as Array<CanvasRichTextPartialBlock>
}

export function serializeCanvasRichTextContent(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock>,
): string {
  return JSON.stringify(blocks)
}

export function extractCanvasRichTextPlainText(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock>,
): string {
  const parts: Array<string> = []

  for (const block of blocks) {
    const text = extractBlockText(block)
    if (text) {
      parts.push(text)
    }
  }

  return parts.join(' ').trim()
}

function extractBlockText(block: CanvasRichTextPartialBlock): string {
  const content = block.content as unknown
  if (!content) {
    return ''
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((item: unknown) => {
        if (typeof item === 'string') {
          return item
        }

        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text
        }

        return ''
      })
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  if (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    content.type === 'tableContent' &&
    'rows' in content &&
    Array.isArray(content.rows)
  ) {
    const rows = content.rows as Array<unknown>

    return rows
      .flatMap((row: unknown) => {
        if (!row || typeof row !== 'object' || !('cells' in row) || !Array.isArray(row.cells)) {
          return []
        }

        return row.cells.flatMap((cell: unknown) =>
          Array.isArray(cell)
            ? cell.flatMap((item: unknown) =>
                item && typeof item === 'object' && 'text' in item && typeof item.text === 'string'
                  ? item.text
                  : '',
              )
            : [],
        )
      })
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  return ''
}
