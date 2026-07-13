import { getValueInlineText } from './values/external-format'
import type { CSSProperties, ReactNode } from 'react'
import type { NoteBlock, InlineContent, TableContent } from './document/model'
import type { NoteItemWithContent } from './item-contract'
import type { EmbeddedNoteContentSource } from './runtime'

export function ReadonlyNoteBlocksSurface({
  className,
  content,
  embeddedNoteContentSource,
  fillHeight = false,
  note,
  style,
}: {
  className?: string
  content: Array<NoteBlock>
  embeddedNoteContentSource: EmbeddedNoteContentSource
  fillHeight?: boolean
  note?: NoteItemWithContent
  style?: CSSProperties
}) {
  return (
    <div
      className={[fillHeight ? 'note-editor-fill-height' : null, className]
        .filter(Boolean)
        .join(' ')}
      data-note-readonly-blocks="true"
      data-note-id={note?.id}
      style={style}
    >
      <ReadonlyNoteBlocks blocks={content} embeddedNoteContentSource={embeddedNoteContentSource} />
    </div>
  )
}

function ReadonlyNoteBlocks({
  blocks,
  embeddedNoteContentSource,
}: {
  blocks: Array<NoteBlock>
  embeddedNoteContentSource: EmbeddedNoteContentSource
}) {
  const rendered: Array<ReactNode> = []
  for (let index = 0; index < blocks.length; ) {
    const block = blocks[index]
    if (block.type === 'bulletListItem' || block.type === 'numberedListItem') {
      const listType = block.type
      const listItems: Array<Extract<NoteBlock, { type: typeof listType }>> = []
      while (blocks[index]?.type === listType) {
        listItems.push(blocks[index] as (typeof listItems)[number])
        index += 1
      }
      const List = listType === 'bulletListItem' ? 'ul' : 'ol'
      rendered.push(
        <List key={`${listType}:${listItems[0].id}`}>
          {listItems.map((listItem) => (
            <ReadonlyNoteBlock
              key={listItem.id}
              block={listItem}
              embeddedNoteContentSource={embeddedNoteContentSource}
            />
          ))}
        </List>,
      )
      continue
    }
    rendered.push(
      <ReadonlyNoteBlock
        key={block.id}
        block={block}
        embeddedNoteContentSource={embeddedNoteContentSource}
      />,
    )
    index += 1
  }
  return rendered
}

function ReadonlyNoteBlock({
  block,
  embeddedNoteContentSource,
}: {
  block: NoteBlock
  embeddedNoteContentSource: EmbeddedNoteContentSource
}) {
  const children = (
    <ReadonlyNoteChildren
      childrenBlocks={block.children}
      embeddedNoteContentSource={embeddedNoteContentSource}
    />
  )
  switch (block.type) {
    case 'heading':
      return <ReadonlyHeadingBlock block={block}>{children}</ReadonlyHeadingBlock>
    case 'bulletListItem':
      return <ReadonlyListItemBlock block={block}>{children}</ReadonlyListItemBlock>
    case 'numberedListItem':
      return <ReadonlyListItemBlock block={block}>{children}</ReadonlyListItemBlock>
    case 'checkListItem':
      return <ReadonlyChecklistBlock block={block}>{children}</ReadonlyChecklistBlock>
    case 'quote':
      return <ReadonlyQuoteBlock block={block}>{children}</ReadonlyQuoteBlock>
    case 'codeBlock':
      return <ReadonlyCodeBlock block={block} />
    case 'divider':
      return <hr />
    case 'embed':
      return (
        <ReadonlyEmbedBlock block={block} embeddedNoteContentSource={embeddedNoteContentSource} />
      )
    case 'table':
      return <ReadonlyTableBlock content={block.content} />
    default:
      return <ReadonlyDefaultBlock block={block}>{children}</ReadonlyDefaultBlock>
  }
}

function ReadonlyHeadingBlock({
  block,
  children,
}: {
  block: Extract<NoteBlock, { type: 'heading' }>
  children: ReactNode
}) {
  const content = (
    <>
      <ReadonlyInlineContent content={block.content} />
      {children}
    </>
  )
  switch (block.props.level) {
    case 1:
      return <h1>{content}</h1>
    case 2:
      return <h2>{content}</h2>
    case 3:
      return <h3>{content}</h3>
    case 4:
      return <h4>{content}</h4>
    case 5:
      return <h5>{content}</h5>
    default:
      return <h6>{content}</h6>
  }
}

function ReadonlyListItemBlock({
  block,
  children,
}: {
  block: Extract<NoteBlock, { type: 'bulletListItem' | 'numberedListItem' }>
  children: ReactNode
}) {
  return (
    <li value={block.type === 'numberedListItem' ? block.props?.start : undefined}>
      <ReadonlyInlineContent content={block.content} />
      {children}
    </li>
  )
}

function ReadonlyChecklistBlock({
  block,
  children,
}: {
  block: Extract<NoteBlock, { type: 'checkListItem' }>
  children: ReactNode
}) {
  return (
    <div data-note-block-type={block.type} data-checked={block.props?.checked ? 'true' : 'false'}>
      <input
        aria-label={block.props?.checked ? 'Checked checklist item' : 'Unchecked checklist item'}
        checked={Boolean(block.props?.checked)}
        disabled
        type="checkbox"
      />
      <ReadonlyInlineContent content={block.content} />
      {children}
    </div>
  )
}

function ReadonlyQuoteBlock({
  block,
  children,
}: {
  block: Extract<NoteBlock, { type: 'quote' }>
  children: ReactNode
}) {
  return (
    <blockquote>
      <ReadonlyInlineContent content={block.content} />
      {children}
    </blockquote>
  )
}

function ReadonlyCodeBlock({ block }: { block: Extract<NoteBlock, { type: 'codeBlock' }> }) {
  return (
    <pre>
      <code>
        <ReadonlyInlineContent content={block.content} />
      </code>
    </pre>
  )
}

function ReadonlyDefaultBlock({ block, children }: { block: NoteBlock; children: ReactNode }) {
  return (
    <div data-note-block-type={block.type}>
      {Array.isArray(block.content) ? <ReadonlyInlineContent content={block.content} /> : null}
      {children}
    </div>
  )
}

function ReadonlyEmbedBlock({
  block,
  embeddedNoteContentSource,
}: {
  block: Extract<NoteBlock, { type: 'embed' }>
  embeddedNoteContentSource: EmbeddedNoteContentSource
}) {
  const props = block.props as {
    note?: NoteItemWithContent
    name?: string
    targetKind?: string
    url?: string
  }
  if (props.targetKind === 'note' && props.note) {
    const content =
      embeddedNoteContentSource.getEmbeddedNoteContent?.(props.note) ?? props.note.content
    return (
      <ReadonlyNoteBlocksSurface
        content={content}
        embeddedNoteContentSource={embeddedNoteContentSource}
        note={props.note}
      />
    )
  }
  return (
    <div data-note-block-type="embed">{props.name ?? props.url ?? props.targetKind ?? 'embed'}</div>
  )
}

function ReadonlyTableBlock({ content }: { content: TableContent | undefined }) {
  if (!content) return null
  const rowEntries = getStableKeyEntries(content.rows, getTableRowKey)
  return (
    <table>
      <tbody>
        {rowEntries.map(({ item: row, key }) => (
          <tr key={key}>
            {getStableKeyEntries(row.cells, getTableCellKey).map(({ item: cell, key: cellKey }) => (
              <td key={cellKey}>
                <ReadonlyInlineContent content={cell.content} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReadonlyInlineContent({ content }: { content: InlineContent | undefined }) {
  if (!content) return null
  return getStableKeyEntries(content, getInlineContentKey).map(({ item: inline, key }) => {
    if (inline.type === 'value') {
      return (
        <span data-note-value-inline="true" key={key}>
          {getValueInlineText(inline.props)}
        </span>
      )
    }
    return <span key={key}>{inline.text}</span>
  })
}

function ReadonlyNoteChildren({
  childrenBlocks,
  embeddedNoteContentSource,
}: {
  childrenBlocks: Array<NoteBlock> | undefined
  embeddedNoteContentSource: EmbeddedNoteContentSource
}) {
  if (!childrenBlocks?.length) return null
  return (
    <div data-note-readonly-children="true">
      <ReadonlyNoteBlocks
        blocks={childrenBlocks}
        embeddedNoteContentSource={embeddedNoteContentSource}
      />
    </div>
  )
}

function getStableKeyEntries<T>(
  items: ReadonlyArray<T>,
  getKey: (item: T) => string,
): Array<{ item: T; key: string }> {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const baseKey = getKey(item)
    const count = seen.get(baseKey) ?? 0
    seen.set(baseKey, count + 1)
    return {
      item,
      key: count === 0 ? baseKey : `${baseKey}:${count}`,
    }
  })
}

function getInlineContentKey(inline: InlineContent[number]) {
  if (inline.type === 'value') {
    return `value:${inline.props.valueId}:${inline.props.slug}:${inline.props.expressionSource}`
  }
  return `text:${inline.text}:${JSON.stringify(inline.styles ?? {})}`
}

function getTableRowKey(row: TableContent['rows'][number]) {
  return JSON.stringify(row)
}

function getTableCellKey(cell: TableContent['rows'][number]['cells'][number]) {
  return JSON.stringify(cell)
}
