import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'
import type { InlineContent, PartialNoteBlock } from './model'

type MarkdownNode = Readonly<{
  type: string
  value?: string
  depth?: number
  ordered?: boolean | null
  start?: number | null
  checked?: boolean | null
  lang?: string | null
  url?: string
  alt?: string | null
  align?: ReadonlyArray<'left' | 'center' | 'right' | null>
  children?: ReadonlyArray<MarkdownNode>
}>

type MarkdownTextStyles = NonNullable<Extract<InlineContent[number], { type: 'text' }>['styles']>

export function markdownToNoteBlocks(markdown: string): Array<PartialNoteBlock> {
  const root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MarkdownNode
  const blocks = markdownBlockNodes(root.children ?? [])
  return blocks.length > 0 ? blocks : [{ type: 'paragraph' }]
}

function markdownBlockNodes(nodes: ReadonlyArray<MarkdownNode>): Array<PartialNoteBlock> {
  return nodes.flatMap(markdownBlockNode)
}

function markdownBlockNode(node: MarkdownNode): Array<PartialNoteBlock> {
  switch (node.type) {
    case 'heading':
      return [
        {
          type: 'heading',
          props: { level: markdownHeadingLevel(node.depth) },
          content: markdownInlineNodes(node.children ?? []),
        },
      ]
    case 'paragraph':
      return [{ type: 'paragraph', content: markdownInlineNodes(node.children ?? []) }]
    case 'thematicBreak':
      return [{ type: 'divider' }]
    case 'code':
      return [
        {
          type: 'codeBlock',
          props: node.lang ? { language: node.lang } : {},
          content: markdownText(node.value ?? ''),
        },
      ]
    case 'blockquote':
      return markdownQuoteBlocks(node.children ?? [])
    case 'list':
      return markdownListBlocks(node)
    case 'table':
      return [markdownTableBlock(node)]
    case 'html':
      return [{ type: 'paragraph', content: markdownText(node.value ?? '') }]
    default:
      return node.children ? markdownBlockNodes(node.children) : []
  }
}

function markdownTableBlock(node: MarkdownNode): PartialNoteBlock {
  const rows = (node.children ?? []).filter((row) => row.type === 'tableRow')
  const columnCount = Math.max(0, ...rows.map((row) => row.children?.length ?? 0))
  return {
    type: 'table',
    content: {
      type: 'tableContent',
      columnWidths: Array.from({ length: columnCount }, () => null),
      headerRows: rows.length > 0 ? 1 : 0,
      rows: rows.map((row) => ({
        cells: Array.from({ length: columnCount }, (_, index) => {
          const alignment = node.align?.[index] ?? null
          return {
            type: 'tableCell',
            content: markdownInlineNodes(row.children?.[index]?.children ?? []),
            ...(alignment ? { props: { textAlignment: alignment } } : {}),
          }
        }),
      })),
    },
  }
}

function markdownQuoteBlocks(nodes: ReadonlyArray<MarkdownNode>): Array<PartialNoteBlock> {
  return markdownBlockNodes(nodes).map((block) =>
    block.type === 'paragraph'
      ? { type: 'quote', content: block.content }
      : { type: 'quote', content: markdownText(markdownBlockPlainText(block)) },
  )
}

function markdownListBlocks(node: MarkdownNode): Array<PartialNoteBlock> {
  let start = node.start ?? 1
  const blocks: Array<PartialNoteBlock> = []
  for (const item of node.children ?? []) {
    if (item.type !== 'listItem') continue
    const [first, ...rest] = item.children ?? []
    const content =
      first?.type === 'paragraph'
        ? markdownInlineNodes(first.children ?? [])
        : markdownText(markdownNodePlainText(first))
    const children = markdownBlockNodes(rest)
    if (item.checked !== null && item.checked !== undefined) {
      blocks.push({ type: 'checkListItem', props: { checked: item.checked }, content, children })
      continue
    }
    if (node.ordered) {
      blocks.push({
        type: 'numberedListItem',
        props: { start },
        content,
        children,
      })
      start += 1
      continue
    }
    blocks.push({ type: 'bulletListItem', content, children })
  }
  return blocks
}

function markdownInlineNodes(
  nodes: ReadonlyArray<MarkdownNode>,
  styles: MarkdownTextStyles = {},
): InlineContent {
  return nodes.flatMap((node) => markdownInlineNode(node, styles))
}

function markdownInlineNode(node: MarkdownNode, styles: MarkdownTextStyles): InlineContent {
  switch (node.type) {
    case 'text':
      return markdownText(node.value ?? '', styles)
    case 'strong':
      return markdownInlineNodes(node.children ?? [], { ...styles, bold: true })
    case 'emphasis':
      return markdownInlineNodes(node.children ?? [], { ...styles, italic: true })
    case 'delete':
      return markdownInlineNodes(node.children ?? [], { ...styles, strike: true })
    case 'inlineCode':
      return markdownText(node.value ?? '', { ...styles, code: true })
    case 'break':
      return markdownText('\n', styles)
    case 'link':
      return markdownLinkText(node, styles)
    case 'image':
      return markdownText(node.alt || node.url || '', styles)
    default:
      return node.children ? markdownInlineNodes(node.children, styles) : []
  }
}

function markdownLinkText(node: MarkdownNode, styles: MarkdownTextStyles): InlineContent {
  const label = markdownNodePlainText(node)
  const url = node.url ?? ''
  return markdownText(label && label !== url ? `${label} (${url})` : url, styles)
}

function markdownText(text: string, styles: MarkdownTextStyles = {}): InlineContent {
  return text.length === 0
    ? []
    : [
        {
          type: 'text',
          text,
          ...(Object.keys(styles).length > 0 ? { styles } : {}),
        },
      ]
}

function markdownHeadingLevel(depth: number | undefined): 1 | 2 | 3 | 4 | 5 | 6 {
  return depth && depth >= 1 && depth <= 6 ? (depth as 1 | 2 | 3 | 4 | 5 | 6) : 1
}

function markdownNodePlainText(node: MarkdownNode | undefined): string {
  if (!node) return ''
  if (node.value !== undefined) return node.value
  if (node.type === 'image') return node.alt || node.url || ''
  return (node.children ?? []).map(markdownNodePlainText).join('')
}

function markdownBlockPlainText(block: PartialNoteBlock): string {
  if (!Array.isArray(block.content)) return ''
  return block.content.map((content) => (content.type === 'text' ? content.text : '')).join('')
}
