import { extractPlainText } from './extractPlainText'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { BlockNoteId, FlatBlockContent } from '../types'

function toFlatBlockContent(block: CustomBlock): FlatBlockContent {
  return { type: block.type, props: block.props, content: block.content } as FlatBlockContent
}

export function flattenBlocks(blocks: Array<CustomBlock>) {
  function makeFlatBlock(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ) {
    const plainText = extractPlainText(toFlatBlockContent(block))
    const inlineContent = block.content !== undefined ? block.content : null
    return {
      blockNoteId: block.id,
      parentBlockId,
      depth,
      position,
      type: block.type,
      props: block.props,
      inlineContent,
      plainText,
    }
  }

  const result: Array<ReturnType<typeof makeFlatBlock>> = []

  function walk(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ) {
    result.push(makeFlatBlock(block, parentBlockId, depth, position))

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
