import * as Y from 'yjs'
import {
  canvasAuthoredDestinations,
  canonicalizeCanvasDocumentContent,
} from '@wizard-archive/editor/canvas/document-contract'
import {
  advanceVersion,
  assertVersionStamp,
  sha256Digest,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { CampaignMutationCtx } from '../../functions'
import {
  authorizeResourceContent,
  contentWriteAuthorizationRejection,
} from './authorizeResourceContent'
import { loadCanvasContentDeletion } from './canvasContent'
import { applyYjsContentDelta, contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection, ContentMergeRetry } from './contentVersion'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import { resourceAuthoredDestinationOccurrences } from '@wizard-archive/editor/resources/authored-destination'
import { replaceResourceReferenceProjection } from './resourceReferences'
import type { ResourceReferenceProjection } from './resourceReferences'
import { queueYjsHistoryCheckpoint } from './itemHistory'

export type SaveCanvasContentResult =
  | Readonly<{
      status: 'completed'
      generation: ContentGeneration
      resourceId: ResourceId
      update: ArrayBuffer
      version: VersionStamp
    }>
  | Readonly<{
      status: 'rejected'
      reason:
        | 'unauthorized'
        | 'content_missing'
        | 'content_corrupt'
        | 'content_generation_conflict'
        | 'content_limit_exceeded'
        | 'version_exhausted'
    }>
  | ContentMergeRetry

export async function saveCanvasContent(
  ctx: CampaignMutationCtx,
  args: { generation: ContentGeneration; resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveCanvasContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'canvas', 'edit')
  const rejection = contentWriteAuthorizationRejection(authorization)
  if (rejection) return { status: 'rejected', reason: rejection }
  const resourceId = args.resourceId
  const content = await loadCanvasContentDeletion(ctx, resourceId)
  if (!content) return { status: 'rejected', reason: 'content_missing' }
  const generation = assertContentGeneration(content.generation ?? INITIAL_CONTENT_GENERATION)
  if (args.generation !== generation) {
    return { status: 'rejected', reason: 'content_generation_conflict' }
  }

  const merged = await mergeCanvasUpdate(
    ctx.resourceScope.campaignId,
    resourceId,
    content.update,
    args.update,
    content.version,
  )
  if (merged.status !== 'completed') return merged
  if (merged.version.digest !== content.version.digest) {
    const projection = await replaceResourceReferenceProjection(ctx, merged.references)
    if (projection.status === 'rejected') return projection
    await ctx.db.patch('resourceCanvasContents', content._id, {
      update: merged.update,
      version: merged.version,
    })
    await queueYjsHistoryCheckpoint(ctx, resourceId, merged.version)
  }
  return {
    status: 'completed',
    generation,
    resourceId,
    update: merged.update,
    version: merged.version,
  }
}

async function mergeCanvasUpdate(
  campaignId: CampaignId,
  resourceId: ResourceId,
  current: ArrayBuffer,
  delta: ArrayBuffer,
  currentVersion: unknown,
): Promise<
  | Readonly<{
      status: 'completed'
      update: ArrayBuffer
      version: VersionStamp
      references: ResourceReferenceProjection
    }>
  | ContentMergeRejection
  | ContentMergeRetry
  | Readonly<{ status: 'rejected'; reason: 'content_limit_exceeded' }>
> {
  if (!canvasEncodedBytesWithinWorkload(current) || !canvasEncodedBytesWithinWorkload(delta)) {
    return { status: 'rejected', reason: 'content_limit_exceeded' }
  }
  const document = new Y.Doc()
  try {
    const pending = applyYjsContentDelta(document, current, delta)
    if (pending) return pending
    const content = canonicalizeCanvasDocumentContent(document)
    if (!content) {
      return { status: 'rejected', reason: 'content_corrupt' }
    }
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    if (!canvasEncodedBytesWithinWorkload(update)) {
      return { status: 'rejected', reason: 'content_limit_exceeded' }
    }
    const version = advanceVersion(
      assertVersionStamp(currentVersion),
      await sha256Digest(new Uint8Array(update)),
    )
    return {
      status: 'completed',
      update,
      version,
      references: {
        campaignId,
        sourceResourceId: resourceId,
        sourceVersion: version,
        occurrences: resourceAuthoredDestinationOccurrences(
          canvasAuthoredDestinations(content.nodes),
        ),
      },
    }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}
