import { Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { CommonRichTextBlock, RichTextText } from './common-model'
import { resolveRichTextColor } from './common-schema'

export function renderCommonRichTextBlocks(
  blocks: ReadonlyArray<CommonRichTextBlock<RichTextText, true>>,
): ReactNode {
  return blocks.map((block) => <Fragment key={block.id}>{renderBlock(block)}</Fragment>)
}

function renderBlock(block: CommonRichTextBlock<RichTextText, true>): ReactNode {
  const body = (
    <>
      {block.type === 'bulletListItem' && '• '}
      {block.type === 'numberedListItem' && `${block.props?.start ?? 1}. `}
      {block.type === 'checkListItem' && (block.props?.checked ? '☑ ' : '☐ ')}
      {block.content?.map((content, index) => (
        <span key={`${block.id}:${index}`} style={inlineStyle(content)}>
          {content.text}
        </span>
      ))}
      {block.children?.length ? (
        <span className="block pl-3">{renderCommonRichTextBlocks(block.children)}</span>
      ) : null}
    </>
  )
  const style = blockStyle(block)
  switch (block.type) {
    case 'heading': {
      const Heading = headingElements[block.props?.level ?? 1]
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

const headingElements = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const

function blockStyle(block: CommonRichTextBlock<RichTextText, true>): CSSProperties {
  const props = block.props ?? {}
  return {
    backgroundColor:
      'backgroundColor' in props
        ? resolveRichTextColor(props.backgroundColor, 'background')
        : undefined,
    color: 'textColor' in props ? resolveRichTextColor(props.textColor, 'text') : undefined,
    textAlign: 'textAlignment' in props ? props.textAlignment : undefined,
  }
}

function inlineStyle(
  content: NonNullable<CommonRichTextBlock<RichTextText, true>['content']>[number],
): CSSProperties {
  const decorations = [
    content.styles?.underline ? 'underline' : '',
    content.styles?.strike ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    backgroundColor: resolveRichTextColor(content.styles?.backgroundColor, 'background'),
    color: resolveRichTextColor(content.styles?.textColor, 'text'),
    fontFamily: content.styles?.code ? 'ui-monospace, monospace' : undefined,
    fontStyle: content.styles?.italic ? 'italic' : undefined,
    fontWeight: content.styles?.bold ? 700 : undefined,
    textDecoration: decorations || undefined,
  }
}
