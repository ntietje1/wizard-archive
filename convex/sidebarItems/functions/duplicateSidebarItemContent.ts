import { ERROR_CODE, throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../blocks/types'
import type { AnySidebarItemRow } from '../types/types'

export function cloneStorageId(storageId: Id<'_storage'> | null): Id<'_storage'> | null {
  // Files and images intentionally share immutable Convex storage references.
  return storageId
}

async function copyYjsUpdates(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', sourceItemId))
    .order('asc')
    .collect()

  await Promise.all(
    updates.map((update) =>
      ctx.db.insert('yjsUpdates', {
        documentId: targetItemId,
        update: update.update,
        seq: update.seq,
        isSnapshot: update.isSnapshot,
      }),
    ),
  )
}

async function copyNoteBlocks(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('noteId', sourceItemId),
    )
    .collect()

  const blockNoteIdMap = new Map<BlockNoteId, BlockNoteId>()
  for (const block of blocks) {
    blockNoteIdMap.set(block.blockNoteId, crypto.randomUUID() as BlockNoteId)
  }

  await Promise.all(
    blocks.map((block) => {
      const blockNoteId = blockNoteIdMap.get(block.blockNoteId)
      if (!blockNoteId) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Failed to remap duplicated note block')
      }
      return ctx.db.insert('blocks', {
        noteId: targetItemId,
        blockNoteId,
        position: block.position,
        parentBlockId: block.parentBlockId
          ? (blockNoteIdMap.get(block.parentBlockId) ?? null)
          : null,
        depth: block.depth,
        type: block.type,
        props: block.props,
        inlineContent: block.inlineContent,
        plainText: block.plainText,
        campaignId: ctx.campaign._id,
        shareStatus: block.shareStatus,
      })
    }),
  )
}

export async function copyDuplicateSidebarItemContent(
  ctx: CampaignMutationCtx,
  source: AnySidebarItemRow,
  targetItemId: Id<'sidebarItems'>,
) {
  switch (source.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      await ctx.db.insert('notes', { sidebarItemId: targetItemId })
      await copyNoteBlocks(ctx, source._id, targetItemId)
      await copyYjsUpdates(ctx, source._id, targetItemId)
      break
    case SIDEBAR_ITEM_TYPES.folders: {
      const sourceFolder = await ctx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      if (!sourceFolder) {
        throwClientError(
          ERROR_CODE.NOT_FOUND,
          `Missing folders companion row for sidebar item ${source._id}`,
        )
      }
      await ctx.db.insert('folders', {
        sidebarItemId: targetItemId,
        inheritShares: sourceFolder.inheritShares,
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const sourceMap = await ctx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      if (!sourceMap) {
        throwClientError(
          ERROR_CODE.NOT_FOUND,
          `Missing gameMaps companion row for sidebar item ${source._id}`,
        )
      }
      await ctx.db.insert('gameMaps', {
        sidebarItemId: targetItemId,
        imageStorageId: cloneStorageId(sourceMap.imageStorageId),
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.files: {
      const sourceFile = await ctx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      if (!sourceFile) {
        throwClientError(
          ERROR_CODE.NOT_FOUND,
          `Missing files companion row for sidebar item ${source._id}`,
        )
      }
      await ctx.db.insert('files', {
        sidebarItemId: targetItemId,
        storageId: cloneStorageId(sourceFile.storageId),
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.canvases:
      await ctx.db.insert('canvases', { sidebarItemId: targetItemId })
      await copyYjsUpdates(ctx, source._id, targetItemId)
      break
    default:
      source satisfies never
  }
}
