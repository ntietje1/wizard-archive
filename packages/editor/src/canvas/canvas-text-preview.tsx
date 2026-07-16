import { COLORS_DEFAULT } from '@blocknote/core'
import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { CanvasTextBlock, CanvasTextDocument } from './text/model'

export function CanvasTextPreview({
  content,
  selected,
  style,
}: {
  content: CanvasTextDocument | undefined
  selected: boolean
  style: CSSProperties
}) {
  return (
    <div
      className={`size-full overflow-hidden whitespace-pre-wrap rounded-md border bg-card p-2 text-sm shadow-sm ${selected ? 'ring-2 ring-ring' : ''}`}
      style={style}
    >
      {content?.length ? (
        renderCanvasTextBlocks(content)
      ) : (
        <span className="text-muted-foreground">Double-click to edit</span>
      )}
    </div>
  )
}

function renderCanvasTextBlocks(blocks: ReadonlyArray<CanvasTextBlock>): ReactNode {
  return blocks.map((block) => <Fragment key={block.id}>{renderCanvasTextBlock(block)}</Fragment>)
}

function renderCanvasTextBlock(block: CanvasTextBlock): ReactNode {
  const body = (
    <>
      {block.type === 'bulletListItem' && '• '}
      {block.type === 'numberedListItem' && `${block.props?.start ?? 1}. `}
      {block.type === 'checkListItem' && (block.props?.checked ? '☑ ' : '☐ ')}
      {block.content?.map((content, index) => (
        <span key={`${block.id}:${index}`} style={canvasTextStyle(content.styles)}>
          {content.text}
        </span>
      ))}
      {block.children?.length ? (
        <span className="block pl-3">{renderCanvasTextBlocks(block.children)}</span>
      ) : null}
    </>
  )
  const style = canvasTextBlockStyle(block)
  switch (block.type) {
    case 'heading': {
      const Heading = canvasHeadingElements[block.props?.level ?? 1]
      return <Heading style={style}>{body}</Heading>
    }
    case 'quote':
      return <blockquote style={style}>{body}</blockquote>
    case 'codeBlock':
      return <pre style={style}>{body}</pre>
    default:
      return <div style={style}>{body}</div>
  }
}

const canvasHeadingElements = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const

function canvasTextBlockStyle(block: CanvasTextBlock): CSSProperties {
  const props = block.props ?? {}
  return {
    backgroundColor:
      'backgroundColor' in props
        ? resolveCanvasTextColor(props.backgroundColor, 'background')
        : undefined,
    color: 'textColor' in props ? resolveCanvasTextColor(props.textColor, 'text') : undefined,
    textAlign: 'textAlignment' in props ? props.textAlignment : undefined,
  }
}

function canvasTextStyle(
  styles: NonNullable<NonNullable<CanvasTextBlock['content']>[number]['styles']> | undefined,
): CSSProperties {
  const decorations = [styles?.underline ? 'underline' : '', styles?.strike ? 'line-through' : '']
    .filter(Boolean)
    .join(' ')
  return {
    backgroundColor: resolveCanvasTextColor(styles?.backgroundColor, 'background'),
    color: resolveCanvasTextColor(styles?.textColor, 'text'),
    fontFamily: styles?.code ? 'ui-monospace, monospace' : undefined,
    fontStyle: styles?.italic ? 'italic' : undefined,
    fontWeight: styles?.bold ? 700 : undefined,
    textDecoration: decorations || undefined,
  }
}

function resolveCanvasTextColor(
  value: string | undefined,
  surface: 'background' | 'text',
): string | undefined {
  if (!value || value === 'default') return undefined
  return COLORS_DEFAULT[value]?.[surface] ?? value
}
