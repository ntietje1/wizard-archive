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
  const editor = BlockNoteEditor.create({
    schema: editorSchema,
  })

  if (isMarkdownFile(fileName, mimeType)) {
    // Our schema uses MdLinkExtension (ProseMirror decorations) instead of
    // BlockNote's built-in link inline content, so [text](url) must remain
    // as literal text in the block content rather than being parsed into a
    // link node (which would be silently dropped by our schema).
    //
    // Strategy: replace link syntax with unique placeholders before parsing,
    // then restore the original text in the resulting blocks. This also
    // prevents URLs from being auto-linked by the GFM parser.
    const { text: preprocessed, placeholders } = extractMarkdownLinks(textContent)
    const blocks = editor.tryParseMarkdownToBlocks(preprocessed)
    if (placeholders.size > 0) {
      restorePlaceholders(blocks, placeholders)
    }
    return blocks
  } else {
    const html = convertTextToHTML(textContent)
    return editor.tryParseHTMLToBlocks(html)
  }
}

/**
 * Replaces markdown link syntax with unique placeholders so the markdown
 * parser doesn't interpret them. Returns the modified text and a map from
 * placeholder → original link text.
 *
 * This is needed because our editor schema doesn't include BlockNote's
 * built-in `link` inline content type — links are rendered via
 * MdLinkExtension which operates on literal `[text](url)` text.
 * Simply escaping brackets isn't enough because the parser also auto-links
 * bare URLs (e.g. `https://...`), which would create link nodes that get
 * silently dropped by our schema.
 */
export function extractMarkdownLinks(markdown: string): {
  text: string
  placeholders: Map<string, string>
} {
  const placeholders = new Map<string, string>()
  let counter = 0
  const lines = markdown.split('\n')
  let inCodeBlock = false
  let fenceLength = 0
  const result: Array<string> = []

  for (const line of lines) {
    const trimmed = line.trimStart()
    const fenceMatch = trimmed.match(/^(`{3,})/)
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true
        fenceLength = fenceMatch[1].length
        result.push(line)
        continue
      } else if (fenceMatch[1].length >= fenceLength) {
        inCodeBlock = false
        fenceLength = 0
        result.push(line)
        continue
      }
    }

    if (inCodeBlock) {
      result.push(line)
      continue
    }

    // Replace image links and regular links with placeholders
    const processed = line.replace(/!?\[([^\]]*)\]\((?:[^()]*|\([^()]*\))*\)/g, (match) => {
      const key = `\u200BLINK${counter++}\u200B`
      placeholders.set(key, match)
      return key
    })
    result.push(processed)
  }

  return { text: result.join('\n'), placeholders }
}

/**
 * Walks through parsed blocks and replaces placeholder tokens with the
 * original link text in all text inline content.
 */
export function restorePlaceholders(
  blocks: Array<CustomPartialBlock>,
  placeholders: Map<string, string>,
): void {
  for (const block of blocks) {
    if (Array.isArray(block.content)) {
      for (const ic of block.content as Array<{ type: string; text?: string }>) {
        if (ic.type === 'text' && ic.text) {
          for (const [key, original] of placeholders) {
            if (ic.text.includes(key)) {
              ic.text = ic.text.replaceAll(key, original)
            }
          }
        }
      }
    }
    if (Array.isArray(block.children)) {
      restorePlaceholders(block.children, placeholders)
    }
  }
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
