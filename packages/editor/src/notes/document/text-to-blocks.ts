import type { Link, StyledText } from '@blocknote/core'
import escapeHtml from 'escape-html'
import { createHeadlessNoteEditor } from './headless-schema'
import type { HeadlessNoteStyleSchema } from './headless-schema'
import type { NoteBlock, PartialNoteBlock } from './model'
import { destroyHeadlessBlockNoteEditor } from './headless-editor-cleanup'
import {
  normalizeValueInlineProps,
  parseValueInlineExternalElement,
  serializeValueInlineMarkdown,
} from '../values/external-format'
import type { NoteValueProps } from '../values/schema'

// Inline content from the parser includes links that our BlockNote schema excludes.
type ParsedInlineContent =
  | StyledText<HeadlessNoteStyleSchema>
  | Link<HeadlessNoteStyleSchema>
  | { type: 'value'; props: NoteValueProps }

type ParsedBlock = {
  type: string
  props?: Record<string, string | number | boolean>
  content?: unknown
  children?: Array<ParsedBlock>
}

type ValueInlineImportToken = {
  inlineContent: { type: 'value'; props: NoteValueProps }
  token: string
}

function textNode(text: string): StyledText<HeadlessNoteStyleSchema> {
  return { type: 'text', text, styles: {} }
}

export function convertBlocksToMarkdown(blocks: Array<PartialNoteBlock>): string {
  const valueTokens: Array<ValueInlineMarkdownToken> = []
  const markdownBlocks = replaceValueInlinesWithMarkdownTokens(blocks, valueTokens)
  const editor = createHeadlessNoteEditor()
  try {
    const markdown = editor.blocksToMarkdownLossy(
      markdownBlocks as unknown as Parameters<typeof editor.blocksToMarkdownLossy>[0],
    )
    return restoreValueInlineMarkdownTokens(markdown, valueTokens)
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
  }
}

type ValueInlineMarkdownToken = {
  markdown: string
  token: string
}

function replaceValueInlinesWithMarkdownTokens(
  blocks: Array<PartialNoteBlock>,
  tokens: Array<ValueInlineMarkdownToken>,
): Array<PartialNoteBlock> {
  return replaceValueInlineNode(blocks, tokens) as Array<PartialNoteBlock>
}

function replaceValueInlineNode(value: unknown, tokens: Array<ValueInlineMarkdownToken>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => replaceValueInlineNode(entry, tokens))
  }

  if (!isRecord(value)) return value

  if (value.type === 'value' && isRecord(value.props)) {
    const token = `WIZARD_ARCHIVE_NOTE_VALUE_INLINE_${tokens.length}_TOKEN`
    tokens.push({
      markdown: serializeValueInlineMarkdown(value.props),
      token,
    })
    return textNode(token)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, replaceValueInlineNode(entry, tokens)]),
  )
}

function restoreValueInlineMarkdownTokens(
  markdown: string,
  tokens: Array<ValueInlineMarkdownToken>,
): string {
  return tokens.reduce(
    (nextMarkdown, { markdown: valueMarkdown, token }) =>
      nextMarkdown.replaceAll(token, valueMarkdown),
    markdown,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMarkdownFile(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase()
  return (
    mimeType === 'text/markdown' ||
    mimeType === 'text/x-markdown' ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  )
}

function isHtmlFile(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase()
  return mimeType === 'text/html' || lowerName.endsWith('.html') || lowerName.endsWith('.htm')
}

export function convertTextContentToBlocks(
  textContent: string,
  {
    fileName,
    mimeType,
  }: {
    fileName: string
    mimeType: string
  },
): Array<NoteBlock> {
  const editor = createHeadlessNoteEditor()

  try {
    if (isMarkdownFile(fileName, mimeType)) {
      const valueTokens: Array<ValueInlineImportToken> = []
      const markdown = replaceValueInlineHtmlWithImportTokens(textContent, valueTokens)
      return restoreValueInlineImportTokens(
        flattenLinksToBlocks(
          editor.tryParseMarkdownToBlocks(markdown) as unknown as Array<ParsedBlock>,
        ),
        valueTokens,
      )
    }

    if (isHtmlFile(fileName, mimeType)) {
      return flattenLinksToBlocks(
        editor.tryParseHTMLToBlocks(textContent) as unknown as Array<ParsedBlock>,
      )
    }

    const html = convertTextToHTML(textContent)
    return flattenLinksToBlocks(editor.tryParseHTMLToBlocks(html) as unknown as Array<ParsedBlock>)
  } finally {
    destroyHeadlessBlockNoteEditor(editor)
  }
}

function flattenLinksToBlocks(parserOutput: Array<ParsedBlock>): Array<NoteBlock> {
  return parserOutput.map(flattenParsedBlockLinks) as unknown as Array<NoteBlock>
}

function replaceValueInlineHtmlWithImportTokens(
  markdown: string,
  tokens: Array<ValueInlineImportToken>,
): string {
  const template = document.createElement('template')
  template.innerHTML = markdown
  for (const element of Array.from(template.content.querySelectorAll('span'))) {
    const props = parseValueInlineExternalElement(element)
    if (!props) continue

    element.replaceWith(document.createTextNode(createValueInlineImportToken(props, tokens)))
  }
  return template.innerHTML
}

function createValueInlineImportToken(
  props: Partial<NoteValueProps>,
  tokens: Array<ValueInlineImportToken>,
): string {
  const token = `WIZARD_ARCHIVE_NOTE_VALUE_IMPORT_${tokens.length}_TOKEN`
  tokens.push({
    inlineContent: { type: 'value', props: normalizeValueInlineProps(props) },
    token,
  })
  return token
}

function restoreValueInlineImportTokens(
  blocks: Array<NoteBlock>,
  tokens: Array<ValueInlineImportToken>,
): Array<NoteBlock> {
  if (tokens.length === 0) return blocks
  return replaceValueInlineImportTokensInNode(blocks, tokens) as Array<NoteBlock>
}

function replaceValueInlineImportTokensInNode(
  value: unknown,
  tokens: Array<ValueInlineImportToken>,
): unknown {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => replaceValueInlineImportTokensInArrayEntry(entry, tokens))
  }

  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      replaceValueInlineImportTokensInNode(entry, tokens),
    ]),
  )
}

function replaceValueInlineImportTokensInArrayEntry(
  entry: unknown,
  tokens: Array<ValueInlineImportToken>,
): Array<unknown> {
  if (isParsedTextNode(entry)) {
    return splitTextNodeByValueInlineTokens(entry, tokens)
  }

  return [replaceValueInlineImportTokensInNode(entry, tokens)]
}

function isParsedTextNode(value: unknown): value is Record<string, unknown> & { text: string } {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string'
}

function splitTextNodeByValueInlineTokens(
  textNodeValue: Record<string, unknown> & { text: string },
  tokens: Array<ValueInlineImportToken>,
): Array<unknown> {
  const parts: Array<unknown> = []
  let remainingText = textNodeValue.text

  while (remainingText.length > 0) {
    const match = findNextValueInlineToken(remainingText, tokens)
    if (!match) {
      parts.push({ ...textNodeValue, text: remainingText })
      break
    }

    if (match.index > 0) {
      parts.push({ ...textNodeValue, text: remainingText.slice(0, match.index) })
    }
    parts.push(match.token.inlineContent)
    remainingText = remainingText.slice(match.index + match.token.token.length)
  }

  return parts
}

function findNextValueInlineToken(
  text: string,
  tokens: Array<ValueInlineImportToken>,
): { index: number; token: ValueInlineImportToken } | null {
  let nextMatch: { index: number; token: ValueInlineImportToken } | null = null
  for (const token of tokens) {
    const index = text.indexOf(token.token)
    if (index === -1) continue
    if (!nextMatch || index < nextMatch.index) {
      nextMatch = { index, token }
    }
  }
  return nextMatch
}

function flattenParsedBlockLinks(block: ParsedBlock): ParsedBlock {
  if (block.type === 'image') return imageBlockToMarkdownParagraph(block)

  return {
    ...block,
    ...(Array.isArray(block.content) ? { content: block.content.map(flattenInlineLinks) } : {}),
    ...(block.children ? { children: block.children.map(flattenParsedBlockLinks) } : {}),
  }
}

function imageBlockToMarkdownParagraph(block: ParsedBlock): ParsedBlock {
  const url = String(block.props?.url ?? '')
  const caption = String(block.props?.caption ?? block.props?.name ?? '')
  return {
    type: 'paragraph',
    content: [textNode(`![${escapeMarkdownImageCaption(caption)}](${escapeMarkdownUrl(url)})`)],
  }
}

function flattenInlineLinks(inlineContent: ParsedInlineContent): ParsedInlineContent {
  if (inlineContent.type !== 'link') return inlineContent
  const rawLinkText = inlineContent.content.map((content) => content.text).join('')
  if (linkLabelIsPlainHref(inlineContent.content, inlineContent.href)) {
    return textNode(inlineContent.href)
  }

  const linkText = inlineContent.content.map(serializeStyledLinkLabelSegment).join('')
  return textNode(
    `[${linkText || escapeMarkdownLinkText(rawLinkText)}](${escapeMarkdownUrl(inlineContent.href)})`,
  )
}

function linkLabelIsPlainHref(
  content: Array<StyledText<HeadlessNoteStyleSchema>>,
  href: string,
): boolean {
  return (
    content.length === 1 &&
    content[0]?.text === href &&
    Object.keys(content[0].styles ?? {}).length === 0
  )
}

function serializeStyledLinkLabelSegment(content: StyledText<HeadlessNoteStyleSchema>): string {
  let text = escapeMarkdownLinkText(content.text)
  const styles = content.styles ?? {}

  if (styles.code) {
    return `\`${text.replace(/`/g, '\\`')}\``
  }
  if (styles.bold) {
    text = `**${text}**`
  }
  if (styles.italic) {
    text = `*${text}*`
  }
  if (styles.strike) {
    text = `~~${text}~~`
  }

  return text
}

function escapeMarkdownImageCaption(caption: string) {
  return caption.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/]/g, '\\]')
}

function escapeMarkdownLinkText(linkText: string) {
  return linkText.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/]/g, '\\]')
}

function escapeMarkdownUrl(url: string) {
  return url.replace(/\\/g, '\\\\').replace(/\)/g, '\\)')
}

function convertTextToHTML(text: string): string {
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
