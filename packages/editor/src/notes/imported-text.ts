import { encodeStateAsUpdate } from 'yjs'
import type { Doc } from 'yjs'
import { SHARE_STATUS } from '../../../../shared/block-shares/share-status'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import type { ResourceImportFile } from '../files/import-contract'
import type { BlockMeta, NoteItemWithContent } from '../notes/item-contract'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc, noteYDocToBlocks } from './document/headless-yjs'
import type { NoteBlock, PartialNoteBlock } from './document/model'
import { convertBlocksToMarkdown, convertTextContentToBlocks } from './document/text-to-blocks'

export interface PlainTextNoteContentInput {
  text: string
  fileName: string
  mimeType?: string
}

export interface ImportedTextNotePayload {
  content: Array<NoteBlock>
  update: ArrayBuffer
}

export type PlainTextNoteContent = Pick<
  NoteItemWithContent,
  'content' | 'blockMeta' | 'blockShareAccessWarnings'
>

export function createNoteYDocFromContent(content: Array<PartialNoteBlock>): Doc {
  return noteBlocksToYDoc(content, NOTE_YJS_FRAGMENT)
}

export function readNoteYDocContent(doc: Doc): Array<NoteBlock> {
  return noteYDocToBlocks(doc, NOTE_YJS_FRAGMENT)
}

export function readNoteYDocMarkdown(doc: Doc): string {
  return convertBlocksToMarkdown(readNoteYDocContent(doc))
}

export function createPlainTextNoteContent({
  text,
  fileName,
  mimeType = 'text/plain',
}: PlainTextNoteContentInput): PlainTextNoteContent {
  const content = convertTextContentToBlocks(text, { fileName, mimeType })
  return {
    content,
    blockMeta: createFullAccessBlockMeta(content),
    blockShareAccessWarnings: [],
  }
}

export async function createImportedTextNoteUpdate(file: ResourceImportFile): Promise<ArrayBuffer> {
  return (await createImportedTextNotePayload(file)).update
}

export async function createImportedTextNotePayload(
  file: ResourceImportFile,
): Promise<ImportedTextNotePayload> {
  const { content: blocks } = createPlainTextNoteContent({
    text: await file.text(),
    fileName: file.name,
    mimeType: file.contentType || undefined,
  })
  const doc = createNoteYDocFromContent(blocks)
  try {
    return { content: blocks, update: toArrayBuffer(encodeStateAsUpdate(doc)) }
  } finally {
    doc.destroy()
  }
}

function createFullAccessBlockMeta(content: ReadonlyArray<NoteBlock>): Record<string, BlockMeta> {
  const blockMeta: Record<string, BlockMeta> = {}
  for (const block of content) {
    collectFullAccessBlockMeta(block, blockMeta)
  }
  return blockMeta
}

function collectFullAccessBlockMeta(block: NoteBlock, blockMeta: Record<string, BlockMeta>) {
  blockMeta[block.id] = {
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    shareStatus: SHARE_STATUS.NOT_SHARED,
    sharedWith: [],
  }
  for (const child of block.children ?? []) {
    collectFullAccessBlockMeta(child, blockMeta)
  }
}

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}
