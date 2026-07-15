import type { NoteBlock } from './model'
import type { NoteBlockId } from '../../resources/domain-id'

type NoteOutlineHeading = Readonly<{
  blockId: NoteBlockId
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
}>

export function noteDocumentOutline(blocks: ReadonlyArray<NoteBlock>) {
  const headings: Array<NoteOutlineHeading> = []
  const visit = (block: NoteBlock) => {
    if (block.type === 'heading') {
      headings.push({
        blockId: block.id,
        level: block.props?.level ?? 1,
        text:
          block.content
            ?.map((inline) => (inline.type === 'text' ? inline.text : inline.props.label))
            .join('')
            .trim() || 'Untitled heading',
      })
    }
    for (const child of block.children ?? []) visit(child)
  }
  for (const block of blocks) visit(block)
  return headings
}
