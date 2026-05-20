import { extractPlainText } from './extractPlainText'
import { inlineContentSchema } from '../blockSchemas'
import type { CustomBlock } from '../../notes/editorSpecs'
import type { BlockNoteId, FlatBlockContent, InlineContent } from '../types'

function toFlatBlockContent(block: CustomBlock): FlatBlockContent {
  return { type: block.type, props: block.props, content: block.content } as FlatBlockContent
}

function toPersistedInlineContentItem(item: unknown): unknown {
  if (
    typeof item !== 'object' ||
    item === null ||
    !('type' in item) ||
    item.type !== 'value' ||
    !('content' in item) ||
    item.content !== undefined
  ) {
    return item
  }

  const { content: _content, ...persistedItem } = item
  return persistedItem
}

function toPersistedInlineContent(block: CustomBlock): InlineContent | null {
  if (!Array.isArray(block.content)) return null
  const result = inlineContentSchema
    .array()
    .safeParse(block.content.map((item) => toPersistedInlineContentItem(item)))
  return result.success ? result.data : null
}

export function flattenBlocks(blocks: Array<CustomBlock>) {
  function makeFlatBlock(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ) {
    const plainText = extractPlainText(toFlatBlockContent(block))
    const inlineContent = toPersistedInlineContent(block)
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
