import { blocksToYDoc as bnBlocksToYDoc, yDocToBlocks as bnYDocToBlocks } from '@blocknote/core/yjs'
import * as Y from 'yjs'
import { noteDocumentSchema, partialNoteDocumentSchema } from './model'
import type { NoteBlock, PartialNoteBlock } from './model'
import { destroyHeadlessBlockNoteEditor } from './headless-editor-cleanup'
import { createHeadlessNoteEditor } from './headless-schema'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'

export class InvalidNoteYjsDocumentError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super('Yjs note document contained invalid blocks')
    this.name = 'InvalidNoteYjsDocumentError'
    this.cause = cause
  }
}

export const NOTE_YJS_FRAGMENT = 'document'

export function createEmptyNoteYDoc(): Y.Doc {
  return noteBlocksToYDoc([{ type: 'paragraph' }], NOTE_YJS_FRAGMENT)
}

export function noteBlocksToYDoc(blocks: Array<PartialNoteBlock>, fragment: string): Y.Doc {
  const parsedBlocks = allocateMissingNoteBlockIds(parsePartialNoteBlocks(blocks))
  const editor = createHeadlessNoteEditor()
  try {
    // BlockNote's Yjs helpers are typed against its default schema, but the runtime accepts our custom schema.
    return bnBlocksToYDoc(
      editor as unknown as Parameters<typeof bnBlocksToYDoc>[0],
      parsedBlocks as Parameters<typeof bnBlocksToYDoc>[1],
      fragment,
    )
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
  }
}

function allocateMissingNoteBlockIds(
  blocks: ReadonlyArray<PartialNoteBlock>,
): Array<PartialNoteBlock> {
  return blocks.map((block) => ({
    ...block,
    id: block.id ?? generateDomainId(DOMAIN_ID_KIND.noteBlock),
    ...(block.children ? { children: allocateMissingNoteBlockIds(block.children) } : {}),
  }))
}

export function noteYDocToBlocks(doc: Y.Doc, fragment: string): Array<NoteBlock> {
  const editor = createHeadlessNoteEditor()
  try {
    return parseNoteBlocks(
      normalizeDecodedNoteBlocks(
        bnYDocToBlocks(editor, doc, fragment) as Array<Record<string, unknown>>,
      ),
    )
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
  }
}

function parseNoteBlocks(blocks: unknown): Array<NoteBlock> {
  const result = noteDocumentSchema.safeParse(blocks)
  if (!result.success) {
    throw new InvalidNoteYjsDocumentError(result.error)
  }
  return result.data
}

function normalizeDecodedNoteBlocks(
  blocks: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return blocks.map(normalizeDecodedNoteBlock)
}

function normalizeDecodedNoteBlock(block: Record<string, unknown>): Record<string, unknown> {
  return stripUndefined({
    ...block,
    content: normalizeDecodedNoteContent(block.content),
    children: Array.isArray(block.children)
      ? normalizeDecodedNoteBlocks(block.children as Array<Record<string, unknown>>)
      : block.children,
  })
}

function normalizeDecodedNoteContent(content: unknown): unknown {
  if (Array.isArray(content)) {
    return content.map(normalizeDecodedInlineContent)
  }

  if (!content || typeof content !== 'object') {
    return content
  }

  const tableContent = content as { rows?: unknown }
  if (!Array.isArray(tableContent.rows)) {
    return content
  }

  return {
    ...tableContent,
    rows: tableContent.rows.map((row) => {
      if (!row || typeof row !== 'object') return row
      const typedRow = row as { cells?: unknown }
      if (!Array.isArray(typedRow.cells)) return row
      return {
        ...typedRow,
        cells: typedRow.cells.map((cell) => {
          if (!cell || typeof cell !== 'object') return cell
          const typedCell = cell as { content?: unknown }
          return {
            ...typedCell,
            content: normalizeDecodedNoteContent(typedCell.content),
          }
        }),
      }
    }),
  }
}

function normalizeDecodedInlineContent(content: unknown): unknown {
  if (!content || typeof content !== 'object') return content
  const inlineContent = content as { content?: unknown; type?: unknown }
  if (inlineContent.type === 'value') {
    const { content: _blockNoteContent, ...valueInlineContent } = inlineContent
    return valueInlineContent
  }
  return content
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined),
  ) as T
}

export function decodeNoteYjsUpdatesToBlocks(
  updates: ReadonlyArray<{ update: ArrayBuffer | Uint8Array }>,
  fragment: string,
): Array<NoteBlock> {
  const doc = new Y.Doc()
  try {
    doc.transact(() => {
      for (const row of updates) {
        Y.applyUpdate(
          doc,
          row.update instanceof Uint8Array ? row.update : new Uint8Array(row.update),
        )
      }
    })
    return noteYDocToBlocks(doc, fragment)
  } finally {
    doc.destroy()
  }
}

function parsePartialNoteBlocks(blocks: unknown): Array<PartialNoteBlock> {
  const result = partialNoteDocumentSchema.safeParse(blocks)
  if (!result.success) {
    throw new TypeError(
      `noteBlocksToYDoc requires an array of note blocks: ${result.error.message}`,
    )
  }
  return result.data
}
