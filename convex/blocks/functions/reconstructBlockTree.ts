import type { Block, BlockNoteId } from '../types'
import type { CustomBlock } from '../../notes/editorSpecs'

export function reconstructBlockTree(flatBlocks: Array<Block>): Array<CustomBlock> {
  const childrenMap = new Map<BlockNoteId | null, Array<Block>>()

  for (const block of flatBlocks) {
    const key = block.parentBlockId
    const list = childrenMap.get(key)
    if (list) list.push(block)
    else childrenMap.set(key, [block])
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }

  const allBlockIds = new Set(flatBlocks.map((b) => b.blockNoteId))
  const orphanedBlocks: Array<{ blockNoteId: BlockNoteId; missingParent: BlockNoteId }> = []
  for (const block of flatBlocks) {
    if (block.parentBlockId !== null && !allBlockIds.has(block.parentBlockId)) {
      orphanedBlocks.push({ blockNoteId: block.blockNoteId, missingParent: block.parentBlockId })
    }
  }
  if (orphanedBlocks.length > 0) {
    console.warn(
      `[reconstructBlockTree] Dropping ${orphanedBlocks.length} orphaned block(s): ${orphanedBlocks.map((b) => `${b.blockNoteId} (missing parent: ${b.missingParent})`).join(', ')}`,
    )
  }

  function buildChildren(
    parentBlockId: BlockNoteId | null,
    visited: Set<BlockNoteId>,
  ): Array<CustomBlock> {
    const children = childrenMap.get(parentBlockId) ?? []
    return children.flatMap((block) => {
      if (visited.has(block.blockNoteId)) {
        console.warn(
          `[reconstructBlockTree] Cycle detected at block "${block.blockNoteId}", skipping`,
        )
        return []
      }
      visited.add(block.blockNoteId)
      const childBlocks = buildChildren(block.blockNoteId, visited)
      return {
        id: block.blockNoteId,
        type: block.type,
        props: block.props,
        content: block.inlineContent ?? undefined,
        children: childBlocks.length > 0 ? childBlocks : undefined,
      } as CustomBlock
    })
  }

  return buildChildren(null, new Set())
}
