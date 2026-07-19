import * as Y from 'yjs'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import { advanceNoteContentVersion } from '@wizard-archive/editor/resources/content-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import {
  NOTE_YJS_FRAGMENT,
  canonicalizeNoteYjsDocument,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import {
  authorizeResourceContent,
  contentWriteAuthorizationRejection,
} from './authorizeResourceContent'
import { applyYjsContentDelta, contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection, ContentMergeRetry } from './contentVersion'
import { findNoteContent } from './noteContent'
import { syncNoteSearchProjection } from './resourceSearchProjection'
import { flattenNoteBlockIds } from './noteBlockAccess'
import { noteAuthoredDestinationOccurrences } from '@wizard-archive/editor/notes/authored-destinations'
import { replaceResourceReferenceProjection } from './resourceReferences'
import type { ResourceReferenceProjection } from './resourceReferences'
import { queueNoteBlockAccessCleanup } from './noteBlockAccessCleanup'
import { queueYjsHistoryCheckpoint } from './itemHistory'

export type SaveNoteContentResult =
  | {
      status: 'completed'
      generation: ContentGeneration
      resourceId: ResourceId
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
    }
  | {
      status: 'rejected'
      reason:
        | 'unauthorized'
        | 'content_missing'
        | 'content_corrupt'
        | 'content_generation_conflict'
        | 'content_limit_exceeded'
        | 'version_exhausted'
    }
  | ContentMergeRetry

export async function saveNoteContent(
  ctx: CampaignMutationCtx,
  args: { generation: ContentGeneration; resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveNoteContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'note', 'edit')
  const rejection = contentWriteAuthorizationRejection(authorization)
  if (rejection) return { status: 'rejected', reason: rejection }
  const resourceId = args.resourceId
  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) {
    return { status: 'rejected', reason: 'content_missing' }
  }
  const generation = assertContentGeneration(content.generation ?? INITIAL_CONTENT_GENERATION)
  if (args.generation !== generation) {
    return { status: 'rejected', reason: 'content_generation_conflict' }
  }

  const merged = await mergeNoteUpdate(
    ctx.resourceScope.campaignId,
    resourceId,
    content.update,
    args.update,
    content.version,
  )
  if (merged.status !== 'completed') return merged
  if (merged.version.digest === content.version.digest) {
    await syncNoteSearchProjection(ctx, resourceId, merged.update)
    return {
      status: 'completed',
      generation,
      resourceId,
      update: merged.update,
      version: merged.version,
    }
  }
  const projection = await replaceResourceReferenceProjection(ctx, merged.references)
  if (projection.status === 'rejected') return projection
  await ctx.db.patch('resourceNoteContents', content._id, {
    update: merged.update,
    version: merged.version,
  })
  await queueNoteBlockAccessCleanup(ctx, resourceId, merged.version, merged.removedBlocks)
  await syncNoteSearchProjection(ctx, resourceId, merged.update)
  await queueYjsHistoryCheckpoint(ctx, resourceId, merged.version)
  return {
    status: 'completed',
    generation,
    resourceId,
    update: merged.update,
    version: merged.version,
  }
}

async function mergeNoteUpdate(
  campaignId: CampaignId,
  resourceId: ResourceId,
  current: ArrayBuffer,
  delta: ArrayBuffer,
  currentVersion: unknown,
): Promise<
  | Readonly<{
      status: 'completed'
      update: ArrayBuffer
      version: Awaited<ReturnType<typeof advanceNoteContentVersion>>
      removedBlocks: boolean
      references: ResourceReferenceProjection
    }>
  | ContentMergeRejection
  | ContentMergeRetry
> {
  const document = new Y.Doc()
  try {
    const previousBlockIds = new Set(
      flattenNoteBlockIds(decodeNoteYjsUpdatesToBlocks([{ update: current }], NOTE_YJS_FRAGMENT)),
    )
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
    for (const blockId of flattenNoteBlockIds(blocks)) previousBlockIds.delete(blockId)
    return {
      status: 'completed',
      update,
      version,
      removedBlocks: previousBlockIds.size > 0,
      references: {
        campaignId,
        sourceResourceId: resourceId,
        sourceVersion: version,
        occurrences: noteAuthoredDestinationOccurrences(blocks),
      },
    }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}
