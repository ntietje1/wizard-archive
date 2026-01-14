import type { Block, BlockMention } from '../blocks/types'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { CustomBlock } from '../notes/editorSpecs'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/types'

export type ExtractedMention = {
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
}

/**
 * Extract all mentions from block content
 */
export function extractMentionsFromBlockContent(
  block: CustomBlock,
): Array<ExtractedMention> {
  const mentions: Array<ExtractedMention> = []

  function traverseImmediate(content: unknown, depth: number = 0) {
    if (!content || depth > 2) return

    if (Array.isArray(content)) {
      content.forEach((item) => traverseImmediate(item, depth + 1))
    } else if (typeof content === 'object') {
      const obj = content as Record<string, unknown>
      if (
        obj.type === 'mention' &&
        obj.props &&
        typeof obj.props === 'object'
      ) {
        const props = obj.props as Record<string, unknown>
        if (props.sidebarItemId && props.sidebarItemType) {
          const mention: ExtractedMention = {
            sidebarItemId: props.sidebarItemId as SidebarItemId,
            sidebarItemType: props.sidebarItemType as SidebarItemType,
          }
          // Avoid duplicates
          if (
            !mentions.some((m) => m.sidebarItemId === mention.sidebarItemId)
          ) {
            mentions.push(mention)
          }
        }
        return
      }

      if (obj.text !== undefined || obj.type === 'text') {
        Object.values(obj).forEach((value) =>
          traverseImmediate(value, depth + 1),
        )
      } else if (obj.content && !obj.id) {
        traverseImmediate(obj.content, depth + 1)
      }
    }
  }

  if (block.content) {
    traverseImmediate(block.content, 0)
  }

  return mentions
}

/**
 * Extract all blocks with their mentions from content
 */
export function extractAllBlocksWithMentions(
  content: Array<CustomBlock>,
): Map<
  string,
  { block: CustomBlock; mentions: Array<ExtractedMention>; isTopLevel: boolean }
> {
  const blocksMap = new Map<
    string,
    {
      block: CustomBlock
      mentions: Array<ExtractedMention>
      isTopLevel: boolean
    }
  >()

  function traverseBlocks(blocks: Array<unknown>, isTopLevel: boolean = false) {
    if (!Array.isArray(blocks)) return

    blocks.forEach((block) => {
      const blockObj = block as CustomBlock
      if (blockObj.id) {
        const mentions = extractMentionsFromBlockContent(blockObj)

        // Store all top-level blocks, or blocks with mentions
        if (isTopLevel || mentions.length > 0) {
          blocksMap.set(blockObj.id, {
            block: blockObj,
            mentions,
            isTopLevel,
          })
        }
      }

      if (Array.isArray(blockObj.children)) {
        traverseBlocks(blockObj.children, false)
      }
    })
  }

  traverseBlocks(content, true)
  return blocksMap
}

/**
 * Compute positions for top-level blocks
 */
export function computeTopLevelPositions(
  allBlocksWithMentions: Map<
    string,
    {
      block: CustomBlock
      mentions: Array<ExtractedMention>
      isTopLevel: boolean
    }
  >,
): Map<string, number> {
  const order = Array.from(allBlocksWithMentions.entries())
    .filter(([_, data]) => data.isTopLevel)
    .map(([id]) => id)
  const positions = new Map<string, number>()
  order.forEach((id, index) => positions.set(id, index))
  return positions
}

/**
 * Get mentions for a block
 */
export async function getBlockMentions(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  blockId: Id<'blocks'>,
): Promise<Array<BlockMention>> {
  return await ctx.db
    .query('blockMentions')
    .withIndex('by_campaign_block_item', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()
}

/**
 * Update block mentions based on new content
 */
export async function updateBlockMentions(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockDbId: Id<'blocks'>,
  existingBlockContent: CustomBlock | undefined,
  newMentions: Array<ExtractedMention>,
): Promise<void> {
  const currentMentions = await getBlockMentions(ctx, campaignId, blockDbId)

  const oldMentions = existingBlockContent
    ? extractMentionsFromBlockContent(existingBlockContent)
    : []

  // Keep manual mentions (not from inline content)
  const manualMentions = currentMentions.filter(
    (m) => !oldMentions.some((om) => om.sidebarItemId === m.sidebarItemId),
  )

  const finalMentionIds = [
    ...new Set([
      ...newMentions.map((m) => m.sidebarItemId),
      ...manualMentions.map((m) => m.sidebarItemId),
    ]),
  ]

  // Remove mentions that are no longer present
  const mentionsToRemove = currentMentions.filter(
    (m) => !finalMentionIds.includes(m.sidebarItemId),
  )
  for (const mention of mentionsToRemove) {
    await ctx.db.delete(mention._id)
  }

  // Add new mentions
  const existingMentionIds = new Set(
    currentMentions.map((m) => m.sidebarItemId),
  )
  const mentionsToAdd = newMentions.filter(
    (m) => !existingMentionIds.has(m.sidebarItemId),
  )
  for (const mention of mentionsToAdd) {
    await ctx.db.insert('blockMentions', {
      campaignId,
      blockId: blockDbId,
      sidebarItemId: mention.sidebarItemId,
      sidebarItemType: mention.sidebarItemType,
    })
  }
}

/**
 * Insert mentions for a new block
 */
export async function insertBlockMentions(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  blockDbId: Id<'blocks'>,
  mentions: Array<ExtractedMention>,
): Promise<void> {
  const uniqueMentions = mentions.filter(
    (m, i, arr) =>
      arr.findIndex((om) => om.sidebarItemId === m.sidebarItemId) === i,
  )
  for (const mention of uniqueMentions) {
    await ctx.db.insert('blockMentions', {
      campaignId,
      blockId: blockDbId,
      sidebarItemId: mention.sidebarItemId,
      sidebarItemType: mention.sidebarItemType,
    })
  }
}

/**
 * Find a block by its BlockNote ID within content
 */
export function findBlockById(
  content: Array<CustomBlock>,
  blockId: string,
): CustomBlock | null {
  for (const block of content) {
    if (block.id === blockId) {
      return block
    }

    if (Array.isArray(block.children)) {
      const found = findBlockById(block.children as Array<CustomBlock>, blockId)
      if (found) return found
    }
  }
  return null
}

/**
 * Clean up blocks that are no longer in content
 */
export async function cleanupUnprocessedBlocks(
  ctx: MutationCtx,
  existingBlocks: Array<Block>,
  processedBlockIds: Set<string>,
  content: Array<CustomBlock>,
  now: number,
): Promise<void> {
  for (const existingBlock of existingBlocks) {
    if (!processedBlockIds.has(existingBlock.blockId)) {
      const currentMentions = await getBlockMentions(
        ctx,
        existingBlock.campaignId,
        existingBlock._id,
      )
      const blockInNewContent = findBlockById(content, existingBlock.blockId)
      const newMentions = blockInNewContent
        ? extractMentionsFromBlockContent(blockInNewContent)
        : []

      const hasAnyMentions =
        currentMentions.length > 0 || newMentions.length > 0

      if (!hasAnyMentions) {
        // Remove all mentions for this block
        for (const mention of currentMentions) {
          await ctx.db.delete(mention._id)
        }
        await ctx.db.delete(existingBlock._id)
      } else {
        await ctx.db.patch(existingBlock._id, {
          isTopLevel: false,
          position: undefined,
          content: blockInNewContent || existingBlock.content,
          updatedAt: now,
        })
      }
    }
  }
}
