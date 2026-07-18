import type * as Y from 'yjs'
import { parseSerializedAuthoredDestination } from '../../resources/authored-destination'
import { noteResourceLinkText } from '../links/resource-link-external'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from './headless-yjs'
import type { InlineContent, NoteBlock } from './model'

export function noteDocumentToMarkdown(document: Y.Doc): string {
  return blocksToMarkdown(noteYDocToBlocks(document, NOTE_YJS_FRAGMENT))
}

function blocksToMarkdown(blocks: ReadonlyArray<NoteBlock>): string {
  const markdownBlocks: Array<string> = []
  for (const block of blocks) {
    const markdown = blockToMarkdown(block)
    if (markdown) markdownBlocks.push(markdown)
  }
  return markdownBlocks.join('\n\n')
}

function blockToMarkdown(block: NoteBlock): string {
  const body = blockBodyToMarkdown(block)
  const children = blocksToMarkdown(block.children ?? [])
  if (!children) return body
  const nestedChildren = children
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
  return body ? `${body}\n${nestedChildren}` : nestedChildren
}

function blockBodyToMarkdown(block: NoteBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineToMarkdown(block.content)
    case 'heading':
      return `${'#'.repeat(block.props.level)} ${inlineToMarkdown(block.content)}`
    case 'bulletListItem':
    case 'toggleListItem':
      return `* ${inlineToMarkdown(block.content)}`
    case 'numberedListItem':
      return `${block.props.start ?? 1}. ${inlineToMarkdown(block.content)}`
    case 'checkListItem':
      return `- [${block.props.checked ? 'x' : ' '}] ${inlineToMarkdown(block.content)}`
    case 'quote':
      return prefixLines(inlineToMarkdown(block.content), '> ')
    case 'codeBlock':
      return codeBlockToMarkdown(block)
    case 'divider':
      return '---'
    case 'embed':
      return embedToMarkdown(block.props.destination)
    case 'table':
      return tableToMarkdown(block)
  }
}

function inlineToMarkdown(content: InlineContent | undefined): string {
  return (content ?? [])
    .map((item) => {
      if (item.type === 'value') {
        return escapeMarkdown(item.props.label || item.props.expressionSource || 'value')
      }
      if (item.type === 'resourceLink') {
        return escapeMarkdown(noteResourceLinkText(item.props))
      }
      if (item.styles?.code) return codeSpan(item.text)
      let text = escapeMarkdown(item.text)
      if (item.styles?.bold) text = `**${text}**`
      if (item.styles?.italic) text = `_${text}_`
      if (item.styles?.strike) text = `~~${text}~~`
      return text
    })
    .join('')
}

function codeBlockToMarkdown(block: Extract<NoteBlock, { type: 'codeBlock' }>): string {
  const content = inlinePlainText(block.content)
  const fence = '`'.repeat(Math.max(3, longestRun(content, '`') + 1))
  const language = block.props.language?.replaceAll(/[`\r\n]/g, '').trim() ?? ''
  return `${fence}${language}\n${content}\n${fence}`
}

function tableToMarkdown(block: Extract<NoteBlock, { type: 'table' }>): string {
  const rows = block.content?.rows ?? []
  if (rows.length === 0) return ''
  const columnCount = Math.max(...rows.map((row) => row.cells.length))
  const markdownRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) =>
      tableCellToMarkdown(row.cells[index]?.content),
    ),
  )
  const divider = Array.from({ length: columnCount }, () => '---')
  return [markdownRows[0], divider, ...markdownRows.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n')
}

function tableCellToMarkdown(content: InlineContent | undefined): string {
  return inlineToMarkdown(content).replaceAll('|', '\\|').replaceAll(/\r?\n/g, '<br>')
}

function embedToMarkdown(serializedDestination: string): string {
  const destination = parseSerializedAuthoredDestination(serializedDestination)
  if (destination === null) return ''
  switch (destination.kind) {
    case 'externalUrl':
      return `[${escapeMarkdown(destination.url)}](${destination.url})`
    case 'unresolved':
      return escapeMarkdown(destination.rawTarget)
    case 'internal':
      return `Embedded ${destination.target.kind}: ${destination.target.resourceId}`
  }
}

function inlinePlainText(content: InlineContent | undefined): string {
  return (content ?? [])
    .map((item) => {
      if (item.type === 'text') return item.text
      if (item.type === 'resourceLink') return noteResourceLinkText(item.props)
      return item.props.label || item.props.expressionSource
    })
    .join('')
}

function codeSpan(value: string): string {
  const fence = '`'.repeat(longestRun(value, '`') + 1)
  const padding = value.startsWith('`') || value.endsWith('`') ? ' ' : ''
  return `${fence}${padding}${value}${padding}${fence}`
}

function longestRun(value: string, character: string): number {
  let longest = 0
  let current = 0
  for (const candidate of value) {
    current = candidate === character ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

function escapeMarkdown(value: string): string {
  return value.replaceAll(/([\\`*{}[\]()<>#+\-.!_|])/g, '\\$1')
}

function prefixLines(value: string, prefix: string): string {
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
}
