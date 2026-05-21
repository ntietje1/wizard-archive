import { extractPlainText } from './extractPlainText'
import { isInlineContentItem, isTableContent } from '../inlineContentValidators'
import type {
  BlockNoteId,
  CustomBlock,
  FlatBlockContent,
  InlineContent,
  TableContent,
} from '../types'

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
  const result: InlineContent = []
  for (const item of block.content) {
    const persistedItem = toPersistedInlineContentItem(item)
    if (!isInlineContentItem(persistedItem)) {
      throw new Error(`[flattenBlocks] Malformed inline content in block ${block.id}`)
    }
    result.push(persistedItem)
  }
  return result
}

function toPersistedContent(block: CustomBlock): InlineContent | TableContent | null {
  if (!block.content) return null
  if (Array.isArray(block.content)) return toPersistedInlineContent(block)
  if (!isTableContent(block.content)) {
    throw new Error(`[flattenBlocks] Malformed block content in block ${block.id}`)
  }
  return block.content
}

export function flattenBlocks(blocks: Array<CustomBlock>) {
  function makeFlatBlock(
    block: CustomBlock,
    parentBlockId: BlockNoteId | null,
    depth: number,
    position: number,
  ) {
    const plainText = extractPlainText(toFlatBlockContent(block))
    const content = toPersistedContent(block)
    const inlineContent = Array.isArray(content) ? content : null
    return {
      blockNoteId: block.id,
      parentBlockId,
      depth,
      position,
      type: block.type,
      props: block.props,
      content,
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
