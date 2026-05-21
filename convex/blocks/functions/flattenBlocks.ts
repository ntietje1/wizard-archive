import { extractPlainText } from './extractPlainText'
import type { BlockNoteId, CustomBlock } from '../../../shared/editor-blocks/types'
import type { PersistedFlatBlock } from '../types'

export function flattenBlocks(blocks: Array<CustomBlock>): Array<PersistedFlatBlock> {
  function makeFlatBlock(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ): PersistedFlatBlock {
    const base = {
      blockNoteId: block.id,
      parentBlockId,
      depth,
      position,
      plainText: extractPlainText(block),
    }

    if (block.type === 'table') {
      return {
        ...base,
        type: block.type,
        props: block.props,
        content: block.content ?? null,
        inlineContent: null,
      }
    }

    const content = block.content ?? null
    return {
      ...base,
      type: block.type,
      props: block.props,
      content,
      inlineContent: content,
    } as PersistedFlatBlock
  }

  const result: Array<PersistedFlatBlock> = []

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
