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

export function isMarkdownFile(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase()
  return (
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  )
}

export function convertTextContentToBlocks(
  textContent: string,
  fileName: string,
  mimeType: string,
): Array<CustomPartialBlock> {
  if (isMarkdownFile(fileName, mimeType)) {
    // parse links into link nodes, then convert back to md link syntax
    const defaultEditor = BlockNoteEditor.create()
    const blocks = defaultEditor.tryParseMarkdownToBlocks(textContent)
    flattenLinksToText(blocks)
    return blocks as unknown as Array<CustomPartialBlock>
  } else {
    const editor = BlockNoteEditor.create({ schema: editorSchema })
    const html = convertTextToHTML(textContent)
    return editor.tryParseHTMLToBlocks(html)
  }
}

/**
 * Walks parsed blocks and converts link inline content nodes to plain text
 * containing the original markdown syntax. Also converts image blocks to
 * paragraphs with literal ![alt](url) text.
 */
function flattenLinksToText(blocks: Array<Record<string, unknown>>): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    // Convert image blocks to paragraphs with literal markdown
    if (block.type === 'image') {
      const props = block.props as Record<string, string> | undefined
      const url = props?.url ?? ''
      const caption = props?.caption ?? props?.name ?? ''
      blocks[i] = {
        type: 'paragraph',
        content: [{ type: 'text', text: `![${caption}](${url})` }],
      }
      continue
    }

    if (Array.isArray(block.content)) {
      const newContent: Array<Record<string, unknown>> = []
      for (const ic of block.content as Array<Record<string, unknown>>) {
        if (ic.type === 'link') {
          const linkText = getLinkText(ic.content as Array<Record<string, unknown>> | undefined)
          const href = (ic.href as string) ?? ''
          if (linkText === href) {
            // Bare URL that was auto-linked — restore as plain text
            newContent.push({ type: 'text', text: href })
          } else {
            newContent.push({ type: 'text', text: `[${linkText}](${href})` })
          }
        } else {
          newContent.push(ic)
        }
      }
      block.content = newContent
    }

    if (Array.isArray(block.children)) {
      flattenLinksToText(block.children as Array<Record<string, unknown>>)
    }
  }
}

function getLinkText(content: Array<Record<string, unknown>> | undefined): string {
  if (!Array.isArray(content)) return ''
  return content.map((c) => (c.text as string) ?? '').join('')
}

export async function convertTextToBlocks(file: File): Promise<Array<CustomPartialBlock>> {
  const textContent = await file.text()
  return convertTextContentToBlocks(textContent, file.name, file.type)
}

export function convertTextToHTML(text: string): string {
  if (!text.trim()) {
    return '<p></p>'
  }

  // Split by all line ending styles: \r\n (Windows), \r (old Mac), \n (Unix)
  const lines = text.split(/\r\n|\r|\n/)

  // Remove trailing empty string caused by a final newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

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
