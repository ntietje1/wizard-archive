import { parseCanvasTextDocument } from './model'
import type { CanvasTextPartialBlock } from './schema'

export type CanvasTextContent = Array<CanvasTextPartialBlock>

interface CanvasValidTextContentState {
  kind: 'valid'
  content: CanvasTextContent
}

interface CanvasInvalidTextContentState {
  kind: 'invalid'
  content: CanvasTextContent
}

export type CanvasTextContentState = CanvasValidTextContentState | CanvasInvalidTextContentState

function createCanvasTextContentState(
  kind: CanvasTextContentState['kind'],
  content: CanvasTextContent,
): CanvasTextContentState {
  return { kind, content }
}

interface CanvasTextContentSnapshot {
  content: Array<CanvasTextPartialBlock>
  serialized: string
}

const EMPTY_CANVAS_TEXT_CONTENT = [{ type: 'paragraph' }] satisfies Array<CanvasTextPartialBlock>

export function createEmptyCanvasTextContent(): CanvasTextContent {
  return cloneCanvasTextContent(EMPTY_CANVAS_TEXT_CONTENT)
}

export function readCanvasTextContentState(value: unknown): CanvasTextContentState {
  if (value === undefined || value === null) {
    return createCanvasTextContentState('valid', createEmptyCanvasTextContent())
  }

  if (Array.isArray(value) && value.length === 0) {
    return createCanvasTextContentState('valid', createEmptyCanvasTextContent())
  }

  const parsedContent = parseCanvasTextDocument(value)
  if (!parsedContent) {
    return createCanvasTextContentState('invalid', createEmptyCanvasTextContent())
  }

  return createCanvasTextContentState(
    'valid',
    cloneCanvasTextContent(parsedContent as CanvasTextContent),
  )
}

export function cloneCanvasTextContent(
  blocks: ReadonlyArray<CanvasTextPartialBlock> | CanvasTextContent,
): CanvasTextContent {
  return JSON.parse(serializeCanvasTextContent(blocks)) as CanvasTextContent
}

export function snapshotCanvasTextContent(
  blocks: ReadonlyArray<CanvasTextPartialBlock> | CanvasTextContent,
): CanvasTextContentSnapshot {
  const serialized = serializeCanvasTextContent(blocks)
  const content = JSON.parse(serialized) as CanvasTextContent
  return {
    content,
    serialized,
  }
}

export function extractCanvasTextPlainText(blocks: ReadonlyArray<CanvasTextPartialBlock>): string {
  const parts: Array<string> = []

  for (const block of blocks) {
    const text = extractBlockText(block)
    if (text) {
      parts.push(text)
    }
  }

  return parts.join(' ').trim()
}

function extractBlockText(block: CanvasTextPartialBlock): string {
  const content = block.content ?? []
  if (content.length === 0) {
    return ''
  }

  return content
    .map((item) => readCanvasTextInlineText(item))
    .filter((item) => item.length > 0)
    .join('')
    .trim()
}

function readCanvasTextInlineText(item: unknown): string {
  if (typeof item !== 'object' || item === null) {
    return ''
  }

  if ('text' in item && typeof item.text === 'string') {
    return item.text
  }

  if ('content' in item && Array.isArray(item.content)) {
    return item.content.map((child) => readCanvasTextInlineText(child)).join('')
  }

  return ''
}

function serializeCanvasTextContent(
  blocks: ReadonlyArray<CanvasTextPartialBlock> | CanvasTextContent,
) {
  return JSON.stringify(blocks)
}
