import { extractPlainText } from './extractPlainText'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { BlockNoteId, BlockProps, BlockType, FlatBlockContent, InlineContent } from '../types'

export type FlatBlockInput = {
  blockNoteId: BlockNoteId
  parentBlockId: BlockNoteId | null
  depth: number
  position: number
  type: BlockType
  props: BlockProps
  inlineContent: InlineContent | null
  plainText: string | null
}

export function flattenBlocks(blocks: Array<CustomBlock>): Array<FlatBlockInput> {
  const result: Array<FlatBlockInput> = []

  function walk(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ) {
    const flatContent: FlatBlockContent = {
      type: block.type,
      props: block.props,
      content: block.content,
    } as FlatBlockContent

    const plainText = extractPlainText(flatContent)

    const inlineContent = block.content !== undefined ? block.content : null

    result.push({
      blockNoteId: block.id,
      parentBlockId,
      depth,
      position,
      type: block.type,
      props: block.props,
      inlineContent,
      plainText,
    })

    if (block.children) {
      for (let i = 0; i < block.children.length; i++) {
        walk(block.children[i], block.id, depth + 1, i)
      }
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    walk(blocks[i], null, 0, i)
  }

  return result
}
