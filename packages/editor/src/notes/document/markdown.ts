import type * as Y from 'yjs'
import { destroyHeadlessBlockNoteEditor } from './headless-editor-cleanup'
import { createHeadlessNoteEditor } from './headless-schema'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from './headless-yjs'

export function noteDocumentToMarkdown(document: Y.Doc): string {
  const blocks = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
  const editor = createHeadlessNoteEditor()
  try {
    return editor.blocksToMarkdownLossy(
      blocks as Parameters<typeof editor.blocksToMarkdownLossy>[0],
    )
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
  }
}
