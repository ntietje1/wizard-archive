import type { NoteBlock } from './model'
import type { NoteBlockId } from '../../resources/domain-id'

type NoteOutlineHeading = Readonly<{
  blockId: NoteBlockId
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
}>

export type NoteOutlineNode = NoteOutlineHeading &
  Readonly<{ children: ReadonlyArray<NoteOutlineNode> }>

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

export function noteOutlineTree(
  headings: ReadonlyArray<NoteOutlineHeading>,
): ReadonlyArray<NoteOutlineNode> {
  const roots: Array<MutableNoteOutlineNode> = []
  const stack: Array<MutableNoteOutlineNode> = []

  for (const heading of headings) {
    const node: MutableNoteOutlineNode = { ...heading, children: [] }
    while (stack.length > 0 && stack.at(-1)!.level >= node.level) stack.pop()
    const parent = stack.at(-1)
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }

  return roots
}

type MutableNoteOutlineNode = NoteOutlineHeading & { children: Array<MutableNoteOutlineNode> }
