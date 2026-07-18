import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { internal } from '../../_generated/api'
import type { CampaignMutationCtx } from '../../functions'
import { flattenNoteBlockIds } from './noteBlockAccess'
import { findNoteContent } from './noteContent'

const NOTE_BLOCK_ACCESS_CLEANUP_BATCH_SIZE = 64

export async function queueNoteBlockAccessCleanup(
  ctx: CampaignMutationCtx,
  noteId: ResourceId,
  contentVersion: ReturnType<typeof assertVersionStamp>,
  hasRemovedBlocks: boolean,
): Promise<void> {
  const campaignId = ctx.resourceScope.campaignId
  const existing = await findCleanupIntent(ctx.db, campaignId, noteId)
  if (!existing && !hasRemovedBlocks) return
  if (existing) {
    await ctx.db.patch(existing._id, {
      contentVersion,
      stage: 'audience',
      cursor: null,
    })
  } else {
    await ctx.db.insert('noteBlockAccessCleanupIntents', {
      campaignUuid: campaignId,
      noteUuid: noteId,
      contentVersion,
      stage: 'audience',
      cursor: null,
    })
  }
  await ctx.scheduler.runAfter(0, internal.resources.internalMutations.cleanupNoteBlockAccess, {
    campaignId,
    noteId,
    contentVersion,
  })
}

export async function cleanupNoteBlockAccess(
  ctx: MutationCtx,
  campaignUuid: string,
  noteUuid: string,
  expectedVersion: unknown,
): Promise<void> {
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, campaignUuid)
  const noteId = assertDomainId(DOMAIN_ID_KIND.resource, noteUuid)
  const contentVersion = assertVersionStamp(expectedVersion)
  const intent = await findCleanupIntent(ctx.db, campaignId, noteId)
  if (!intent || !versionStampEquals(assertVersionStamp(intent.contentVersion), contentVersion)) {
    return
  }
  const content = await findNoteContent(ctx.db, noteId)
  if (!content || !versionStampEquals(assertVersionStamp(content.version), contentVersion)) {
    return
  }
  let retainedBlockIds: ReadonlySet<string>
  try {
    retainedBlockIds = new Set(
      flattenNoteBlockIds(
        decodeNoteYjsUpdatesToBlocks([{ update: content.update }], NOTE_YJS_FRAGMENT),
      ),
    )
  } catch {
    return
  }
  const page =
    intent.stage === 'audience'
      ? await ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignId).eq('noteUuid', noteId),
          )
          .paginate({ cursor: intent.cursor, numItems: NOTE_BLOCK_ACCESS_CLEANUP_BATCH_SIZE })
      : await ctx.db
          .query('noteBlockMemberAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', campaignId).eq('noteUuid', noteId),
          )
          .paginate({ cursor: intent.cursor, numItems: NOTE_BLOCK_ACCESS_CLEANUP_BATCH_SIZE })
  await Promise.all(
    page.page.flatMap((row) =>
      retainedBlockIds.has(row.blockUuid) ? [] : [ctx.db.delete(row._id)],
    ),
  )
  if (!page.isDone) {
    await ctx.db.patch(intent._id, { cursor: page.continueCursor })
    await scheduleNextCleanup(ctx, campaignId, noteId, contentVersion)
    return
  }
  if (intent.stage === 'audience') {
    await ctx.db.patch(intent._id, { stage: 'member', cursor: null })
    await scheduleNextCleanup(ctx, campaignId, noteId, contentVersion)
    return
  }
  await ctx.db.delete(intent._id)
}

async function findCleanupIntent(
  db: GenericDatabaseReader<DataModel>,
  campaignId: CampaignId,
  noteId: ResourceId,
) {
  return await db
    .query('noteBlockAccessCleanupIntents')
    .withIndex('by_note', (query) => query.eq('campaignUuid', campaignId).eq('noteUuid', noteId))
    .unique()
}

async function scheduleNextCleanup(
  ctx: MutationCtx,
  campaignId: CampaignId,
  noteId: ResourceId,
  contentVersion: ReturnType<typeof assertVersionStamp>,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.resources.internalMutations.cleanupNoteBlockAccess, {
    campaignId,
    noteId,
    contentVersion,
  })
}
