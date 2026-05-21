import { BlockNoteSchema } from '@blocknote/core'
import { CANVAS_BLOCK_TYPES } from '../../../../../shared/blockRegistry'
import { customBlockSpecs } from '../../../../../shared/editor-blocknote-spec-factory'
import { parseCanvasRichTextDocument } from 'convex/blocks/blockSchemas'
import { customInlineContentSpecs, customStyleSpecs } from '~/features/editor/editor-dom-specs'
import type {
  BlockNoteEditor,
  BlockSpecs,
  InlineContentSpecs,
  PartialBlock,
  StyleSpecs,
} from '@blocknote/core'

const canvasRichTextBlockSpecs = Object.fromEntries(
  CANVAS_BLOCK_TYPES.map((type) => [type, customBlockSpecs[type]]),
) as BlockSpecs

const canvasRichTextInlineContentSpecs: InlineContentSpecs = customInlineContentSpecs

const canvasRichTextStyleSpecs: StyleSpecs = customStyleSpecs

export const canvasRichTextEditorSchema = BlockNoteSchema.create({
  blockSpecs: canvasRichTextBlockSpecs,
  inlineContentSpecs: canvasRichTextInlineContentSpecs,
  styleSpecs: canvasRichTextStyleSpecs,
})

type CanvasRichTextBlockSchema = typeof canvasRichTextEditorSchema.blockSchema
type CanvasRichTextInlineContentSchema = typeof canvasRichTextEditorSchema.inlineContentSchema
type CanvasRichTextStyleSchema = typeof canvasRichTextEditorSchema.styleSchema

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

export type CanvasRichTextContent = Array<CanvasRichTextPartialBlock>

interface CanvasValidRichTextContentState {
  kind: 'valid'
  content: CanvasRichTextContent
}

interface CanvasInvalidRichTextContentState {
  kind: 'invalid'
  content: CanvasRichTextContent
}

export type CanvasRichTextContentState =
  | CanvasValidRichTextContentState
  | CanvasInvalidRichTextContentState

function createCanvasRichTextContentState(
  kind: CanvasRichTextContentState['kind'],
  content: CanvasRichTextContent,
): CanvasRichTextContentState {
  return { kind, content }
}

interface CanvasRichTextContentSnapshot {
  content: Array<CanvasRichTextPartialBlock>
  serialized: string
}

const EMPTY_CANVAS_RICH_TEXT_CONTENT = [
  { type: 'paragraph' },
] satisfies Array<CanvasRichTextPartialBlock>

export function createEmptyCanvasRichTextContent(): CanvasRichTextContent {
  return cloneCanvasRichTextContent(EMPTY_CANVAS_RICH_TEXT_CONTENT)
}

export function readCanvasRichTextContentState(value: unknown): CanvasRichTextContentState {
  if (value === undefined || value === null) {
    return createCanvasRichTextContentState('valid', createEmptyCanvasRichTextContent())
  }

  if (Array.isArray(value) && value.length === 0) {
    return createCanvasRichTextContentState('valid', createEmptyCanvasRichTextContent())
  }

  const parsedContent = parseCanvasRichTextDocument(value)
  if (!parsedContent) {
    return createCanvasRichTextContentState('invalid', createEmptyCanvasRichTextContent())
  }

  return createCanvasRichTextContentState(
    'valid',
    cloneCanvasRichTextContent(parsedContent as CanvasRichTextContent),
  )
}

export function cloneCanvasRichTextContent(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock> | CanvasRichTextContent,
): CanvasRichTextContent {
  return JSON.parse(serializeCanvasRichTextContent(blocks)) as CanvasRichTextContent
}

export function snapshotCanvasRichTextContent(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock> | CanvasRichTextContent,
): CanvasRichTextContentSnapshot {
  const serialized = serializeCanvasRichTextContent(blocks)
  const content = JSON.parse(serialized) as CanvasRichTextContent
  return {
    content,
    serialized,
  }
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
  const content = block.content ?? []
  if (content.length === 0) {
    return ''
  }

  return content
    .map((item) => readCanvasRichTextInlineText(item))
    .filter((item) => item.length > 0)
    .join(' ')
    .trim()
}

function readCanvasRichTextInlineText(item: unknown): string {
  if (typeof item !== 'object' || item === null) {
    return ''
  }

  return 'text' in item && typeof item.text === 'string' ? item.text : ''
}

function serializeCanvasRichTextContent(
  blocks: ReadonlyArray<CanvasRichTextPartialBlock> | CanvasRichTextContent,
) {
  return JSON.stringify(blocks)
}
