import * as Y from 'yjs'
import type { NoteBlockId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { advanceNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  NOTE_YJS_FRAGMENT,
  canonicalizeNoteYjsDocument,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { applyYjsContentDelta, contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection, ContentMergeRetry } from './contentVersion'
import { findNoteContent } from './noteContent'
import { syncNoteSearchProjection } from './resourceSearchProjection'
import { flattenNoteBlockIds, loadNoteBlockAccessRows } from './noteBlockAccess'

export type SaveNoteContentResult =
  | {
      status: 'completed'
      resourceId: ResourceId
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
    }
  | {
      status: 'rejected'
      reason: 'unauthorized' | 'content_missing' | 'content_corrupt' | 'version_exhausted'
    }
  | ContentMergeRetry

export async function saveNoteContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveNoteContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'note', 'edit')
  if (authorization.status !== 'authorized') {
    return {
      status: 'rejected',
      reason: authorization.reason === 'unauthorized' ? 'unauthorized' : 'content_corrupt',
    }
  }
  const resourceId = args.resourceId
  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) {
    return { status: 'rejected', reason: 'content_missing' }
  }

  const merged = await mergeNoteUpdate(content.update, args.update, content.version)
  if (merged.status !== 'completed') return merged
  if (merged.version.digest !== content.version.digest) {
    await ctx.db.patch('resourceNoteContents', content._id, {
      update: merged.update,
      version: merged.version,
    })
  }
  await removeDeletedBlockAccess(ctx, resourceId, new Set(merged.blockIds))
  await syncNoteSearchProjection(ctx, resourceId, merged.update)
  return { status: 'completed', resourceId, update: merged.update, version: merged.version }
}

async function mergeNoteUpdate(
  current: ArrayBuffer,
  delta: ArrayBuffer,
  currentVersion: unknown,
): Promise<
  | Readonly<{
      status: 'completed'
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
      blockIds: ReadonlyArray<NoteBlockId>
    }>
  | ContentMergeRejection
  | ContentMergeRetry
> {
  const document = new Y.Doc()
  try {
    const pending = applyYjsContentDelta(document, current, delta)
    if (pending) return pending
    const blocks = canonicalizeNoteYjsDocument(document, NOTE_YJS_FRAGMENT)
    if (!blocks) {
      return { status: 'rejected', reason: 'content_corrupt' }
    }
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    const version = await advanceNoteContentVersion(
      assertVersionStamp(currentVersion),
      new Uint8Array(update),
    )
    return { status: 'completed', update, version, blockIds: flattenNoteBlockIds(blocks) }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}

async function removeDeletedBlockAccess(
  ctx: CampaignMutationCtx,
  noteId: ResourceId,
  retainedBlockIds: ReadonlySet<NoteBlockId>,
): Promise<void> {
  const { audienceRows, memberRows } = await loadNoteBlockAccessRows(
    ctx,
    ctx.resourceScope.campaignId,
    noteId,
  )
  const staleRows = [...audienceRows, ...memberRows].filter(
    (row) => !retainedBlockIds.has(row.blockUuid),
  )
  await Promise.all(staleRows.map((row) => ctx.db.delete(row._id)))
}
