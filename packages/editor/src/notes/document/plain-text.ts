import type { InlineContent, NoteBlock } from './model'

function inlineText(content: InlineContent | undefined): string {
  return (content ?? [])
    .map((item) => (item.type === 'text' ? item.text : item.props.expressionSource))
    .join('')
}

function blockText(block: NoteBlock): ReadonlyArray<string> {
  const own =
    block.type === 'table'
      ? (block.content?.rows.flatMap((row) => row.cells.map((cell) => inlineText(cell.content))) ??
        [])
      : block.type === 'embed'
        ? []
        : [inlineText(block.content)]
  return [...own, ...(block.children ?? []).flatMap(blockText)]
}

export function noteBlocksPlainText(blocks: ReadonlyArray<NoteBlock>): string {
  return blocks.flatMap(blockText).filter(Boolean).join('\n')
}
