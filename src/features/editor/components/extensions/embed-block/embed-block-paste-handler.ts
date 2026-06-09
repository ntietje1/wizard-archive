import { containsExternalEmbedBlockHtml } from './embed-block-html'
import type { BlockNoteEditor } from '@blocknote/core'

type NoteEditorPasteHandlerContext = {
  event: ClipboardEvent
  editor: BlockNoteEditor<any, any, any>
  defaultPasteHandler: (context?: {
    prioritizeMarkdownOverHTML?: boolean
    plainTextAsMarkdown?: boolean
  }) => boolean | undefined
}

export function noteEditorPasteHandler({
  event,
  editor,
  defaultPasteHandler,
}: NoteEditorPasteHandlerContext) {
  const html = event.clipboardData?.getData('text/html')
  if (!html || !containsExternalEmbedBlockHtml(html)) return defaultPasteHandler()

  const parsedBlocks = editor.tryParseHTMLToBlocks(html)
  const cursor = editor.getTextCursorPosition()

  if (isEmptyParagraph(cursor.block)) {
    editor.replaceBlocks([cursor.block], parsedBlocks)
  } else {
    editor.insertBlocks(parsedBlocks, cursor.block, 'after')
  }
  return true
}

function isEmptyParagraph(block: { type: string; content?: unknown }) {
  return block.type === 'paragraph' && Array.isArray(block.content) && block.content.length === 0
}
