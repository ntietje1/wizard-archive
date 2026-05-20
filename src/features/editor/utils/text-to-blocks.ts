import { BlockNoteEditor } from '@blocknote/core'
import type { Link, StyledText } from '@blocknote/core'
import { createEditorSchema } from '../editorSchema'
import escapeHtml from 'escape-html'
import type { CustomBlock, CustomPartialBlock, CustomStyleSchema } from 'convex/notes/editorSpecs'

// Inline content from the parser — includes links that our editor schema excludes.
type ParsedInlineContent = StyledText<CustomStyleSchema> | Link<CustomStyleSchema>

type ParsedBlock = {
  type: string
  props?: Record<string, string | number | boolean>
  content?: Array<ParsedInlineContent>
  children?: Array<ParsedBlock>
}

function textNode(text: string): StyledText<CustomStyleSchema> {
  return { type: 'text', text, styles: {} }
}

export function convertBlocksToMarkdown(blocks: Array<CustomPartialBlock>): string {
  const editor = BlockNoteEditor.create({
    schema: createEditorSchema(),
  })
  return editor.blocksToMarkdownLossy(
    blocks as unknown as Parameters<typeof editor.blocksToMarkdownLossy>[0],
  )
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
): Array<CustomBlock> {
  const editor = BlockNoteEditor.create({ schema: createEditorSchema() })

  if (isMarkdownFile(fileName, mimeType)) {
    return flattenLinksToBlocks(
      editor.tryParseMarkdownToBlocks(textContent) as unknown as Array<ParsedBlock>,
    )
  } else {
    const html = convertTextToHTML(textContent)
    return flattenLinksToBlocks(editor.tryParseHTMLToBlocks(html) as unknown as Array<ParsedBlock>)
  }
}

/** Replaces link/image nodes with plain markdown text. ParsedBlock in, CustomBlock out. */
function flattenLinksToBlocks(parserOutput: Array<ParsedBlock>): Array<CustomBlock> {
  const blocks = [...parserOutput]

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type === 'image') {
      const url = String(block.props?.url ?? '')
      const caption = String(block.props?.caption ?? block.props?.name ?? '')
      const escapedCaption = caption.replace(/\\/g, '\\\\').replace(/]/g, '\\]')
      const escapedUrl = url.replace(/\\/g, '\\\\').replace(/\)/g, '\\)')
      blocks[i] = {
        type: 'paragraph',
        content: [textNode(`![${escapedCaption}](${escapedUrl})`)],
      }
      continue
    }

    if (block.content) {
      const newContent: Array<ParsedInlineContent> = []
      for (const ic of block.content) {
        if (ic.type === 'link') {
          const linkText = ic.content.map((c) => c.text).join('')
          if (linkText === ic.href) {
            newContent.push(textNode(ic.href))
          } else {
            const escapedLinkText = linkText
              .replace(/\\/g, '\\\\')
              .replace(/\[/g, '\\[')
              .replace(/]/g, '\\]')
            const escapedHref = ic.href.replace(/\\/g, '\\\\').replace(/\)/g, '\\)')
            newContent.push(textNode(`[${escapedLinkText}](${escapedHref})`))
          }
        } else {
          newContent.push(ic)
        }
      }
      block.content = newContent
    }

    if (block.children) {
      block.children = flattenLinksToBlocks(block.children) as unknown as Array<ParsedBlock>
    }
  }

  return blocks as unknown as Array<CustomBlock>
}

export async function convertTextToBlocks(file: File): Promise<Array<CustomBlock>> {
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
