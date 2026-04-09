import { BlockNoteEditor } from '@blocknote/core'
import { editorSchema } from 'convex/notes/editorSpecs'
import escapeHtml from 'escape-html'
import type { CustomPartialBlock } from 'convex/notes/editorSpecs'

export function convertBlocksToMarkdown(blocks: Array<CustomPartialBlock>): string {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
  })
  return editor.blocksToMarkdownLossy(blocks)
}

export async function convertTextToBlocks(file: File): Promise<Array<CustomPartialBlock>> {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
  })

  const textContent = await file.text()
  const mimeType = file.type
  const fileName = file.name

  const isMarkdown =
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    fileName.toLowerCase().endsWith('.md') ||
    fileName.toLowerCase().endsWith('.markdown')

  if (isMarkdown) {
    return editor.tryParseMarkdownToBlocks(textContent)
  } else {
    const html = convertTextToHTML(textContent)
    return editor.tryParseHTMLToBlocks(html)
  }
}

function convertTextToHTML(text: string): string {
  if (!text.trim()) {
    return '<p></p>'
  }

  // Split by newlines and process each line
  const lines = text.split(/\r?\n/)
  const paragraphs: Array<string> = []

  for (const line of lines) {
    if (line.trim() === '') {
      // Empty line - create an empty paragraph to preserve spacing
      paragraphs.push('<p></p>')
    } else {
      // Non-empty line - escape HTML entities and wrap in paragraph
      const escaped = escapeHtml(line)
      paragraphs.push(`<p>${escaped}</p>`)
    }
  }

  return paragraphs.join('')
}
