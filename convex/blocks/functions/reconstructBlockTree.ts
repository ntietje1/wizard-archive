import type { Block } from '../types'
import type { CustomBlock } from '../../notes/editorSpecs'

export function reconstructBlockTree(flatBlocks: Array<Block>): Array<CustomBlock> {
  const childrenMap = new Map<string | null, Array<Block>>()

  for (const block of flatBlocks) {
    const key = block.parentBlockId
    const list = childrenMap.get(key)
    if (list) list.push(block)
    else childrenMap.set(key, [block])
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }

  const allBlockIds = new Set(flatBlocks.map((b) => b.blockId))
  const orphanedBlocks: Array<{ blockId: string; missingParent: string }> = []
  for (const block of flatBlocks) {
    if (block.parentBlockId !== null && !allBlockIds.has(block.parentBlockId)) {
      orphanedBlocks.push({ blockId: block.blockId, missingParent: block.parentBlockId })
    }
  }
  if (orphanedBlocks.length > 0) {
    console.warn(
      `[reconstructBlockTree] Dropping ${orphanedBlocks.length} orphaned block(s): ${orphanedBlocks.map((b) => `${b.blockId} (missing parent: ${b.missingParent})`).join(', ')}`,
    )
  }

  function buildChildren(parentBlockId: string | null, visited: Set<string>): Array<CustomBlock> {
    const children = childrenMap.get(parentBlockId) ?? []
    return children.flatMap((block) => {
      if (visited.has(block.blockId)) {
        console.warn(`[reconstructBlockTree] Cycle detected at block "${block.blockId}", skipping`)
        return []
      }
      visited.add(block.blockId)
      const childBlocks = buildChildren(block.blockId, visited)
      return {
        id: block.blockId,
        type: block.type,
        props: block.props as Record<string, unknown>,
        content: block.inlineContent ?? undefined,
        children: childBlocks.length > 0 ? childBlocks : undefined,
      } as CustomBlock
    })
  }

  return buildChildren(null, new Set())
}
