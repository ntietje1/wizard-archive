import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import { flattenBlocks } from './flattenBlocks'
import { parseBlockNoteBlocks } from '../parseBlockNoteBlocks'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type { Block, BlockInsert, PersistedFlatBlock } from '../types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'

export async function saveAllBlocksForNote(
  ctx: Pick<MutationCtx, 'db'>,
  { noteId, content }: { noteId: Id<'sidebarItems'>; content: Array<NoteBlock> },
): Promise<Array<Block>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Block projection requires a note item')
  }
  if (!isActiveSidebarItem(note)) return []
  const campaignId = note.campaignId

  const existingBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
    .collect()

  const existingBlocksMap = new Map(existingBlocks.map((block) => [block.blockNoteId, block]))

  const canonicalContent = parseBlockNoteBlocks(content)
  const rawFlatBlocks = flattenBlocks(canonicalContent)
  await validateResourceEmbedTargets(ctx, {
    noteId,
    campaignId,
    flatBlocks: rawFlatBlocks,
  })
  const deduped = new Map<string, (typeof rawFlatBlocks)[number]>()
  for (const flat of rawFlatBlocks) {
    if (deduped.has(flat.blockNoteId)) {
      console.warn(
        `[saveAllBlocksForNote] Duplicate blockNoteId "${flat.blockNoteId}" in note ${noteId}, keeping first occurrence`,
      )
    } else {
      deduped.set(flat.blockNoteId, flat)
    }
  }
  const flatBlocks = [...deduped.values()]
  const incomingBlockIds = new Set(flatBlocks.map((b) => b.blockNoteId))
  await asyncMap(flatBlocks, async (flat): Promise<void> => {
    const existing = existingBlocksMap.get(flat.blockNoteId)
    if (existing) {
      await replacePersistedBlock(ctx, existing._id, flat)
      return
    }

    await insertPersistedBlock(ctx, {
      ...flat,
      noteId,
      campaignId,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
  })

  // hard delete blocks that don't exist in the document anymore
  const blocksToDelete = existingBlocks.filter((b) => !incomingBlockIds.has(b.blockNoteId))
  await asyncMap(blocksToDelete, async (block) => {
    const blockShares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', campaignId).eq('blockId', block._id),
      )
      .collect()

    await asyncMap(blockShares, (share) => ctx.db.delete('blockShares', share._id))
    await ctx.db.delete('blocks', block._id)
  })

  const finalBlocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId))
    .collect()
  const finalBlocksMap = new Map(finalBlocks.map((block) => [block.blockNoteId, block]))

  return flatBlocks.map((flat) => {
    const block = finalBlocksMap.get(flat.blockNoteId)
    if (!block) {
      // Invariant: every incoming flat block has just been inserted or updated above.
      throw new Error(`Block ${flat.blockNoteId} missing after saveAllBlocksForNote`)
    }
    return block
  })
}

async function insertPersistedBlock(
  ctx: Pick<MutationCtx, 'db'>,
  params: BlockInsert,
): Promise<Id<'blocks'>> {
  validatePersistedBlockDepth(params)
  return await ctx.db.insert('blocks', params)
}

async function replacePersistedBlock(
  ctx: Pick<MutationCtx, 'db'>,
  blockDbId: Id<'blocks'>,
  block: PersistedFlatBlock,
): Promise<void> {
  validatePersistedBlockDepth(block)
  await ctx.db.patch('blocks', blockDbId, {
    parentBlockId: block.parentBlockId,
    depth: block.depth,
    position: block.position,
    type: block.type,
    props: block.props,
    content: block.content,
    plainText: block.plainText,
  })
}

function validatePersistedBlockDepth(block: Pick<PersistedFlatBlock, 'depth' | 'parentBlockId'>) {
  if (block.depth < 0) throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be non-negative')
  if (block.parentBlockId === null && block.depth !== 0) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be 0 when parentBlockId is null')
  }
  if (block.parentBlockId !== null && block.depth === 0) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'depth must be > 0 when parentBlockId is set')
  }
}

async function validateResourceEmbedTargets(
  ctx: Pick<MutationCtx, 'db'>,
  {
    noteId,
    campaignId,
    flatBlocks,
  }: {
    noteId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    flatBlocks: Array<PersistedFlatBlock>
  },
) {
  const targetIds = new Set<Id<'sidebarItems'>>()
  for (const block of flatBlocks) {
    const targetId = getResourceEmbedTargetId(ctx, block)
    if (!targetId) continue
    if (targetId === noteId) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'A note cannot embed itself')
    }
    targetIds.add(targetId)
  }

  await asyncMap([...targetIds], async (targetId) => {
    const item = await ctx.db.get('sidebarItems', targetId)
    if (!item) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Embed target not found')
    }
    if (item.campaignId !== campaignId) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Embed target belongs to different campaign')
    }
    if (!isActiveSidebarItem(item)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Embed target is not an active sidebar item')
    }
  })
}

function getResourceEmbedTargetId(
  ctx: Pick<MutationCtx, 'db'>,
  block: PersistedFlatBlock,
): Id<'sidebarItems'> | null {
  if (block.type !== 'embed') return null
  const props = block.props
  if (
    props &&
    typeof props === 'object' &&
    'targetKind' in props &&
    props.targetKind === 'resource' &&
    'resourceId' in props &&
    typeof props.resourceId === 'string'
  ) {
    const resourceId = ctx.db.normalizeId('sidebarItems', props.resourceId)
    if (!resourceId) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Invalid embed target resourceId for block ${block.blockNoteId}`,
      )
    }
    return resourceId
  }
  return null
}
