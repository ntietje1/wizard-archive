import { BlockNoteEditor } from '@blocknote/core'
import escapeHtml from 'escape-html'
import { editorSchema } from './editor-schema'
import type { CustomPartialBlock } from './editor-schema'

export async function convertBlocksToMarkdown(
  blocks: Array<CustomPartialBlock>,
): Promise<string> {
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
  })
  const markdown = await editor.blocksToMarkdownLossy(blocks)
  return markdown
}

export async function convertTextToBlocks(
  file: File,
): Promise<Array<CustomPartialBlock>> {
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
    return await editor.tryParseMarkdownToBlocks(textContent)
  } else {
    const html = convertTextToHTML(textContent)
    return await editor.tryParseHTMLToBlocks(html)
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
