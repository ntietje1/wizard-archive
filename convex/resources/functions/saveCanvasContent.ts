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
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadCanvasContentDeletion } from './canvasContent'
import { applyYjsContentDelta, contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection, ContentMergeRetry } from './contentVersion'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'
import { replaceResourceReferenceProjection } from './resourceReferences'
import type { ResourceReferenceProjection } from './resourceReferences'

export type SaveCanvasContentResult =
  | Readonly<{
      status: 'completed'
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
        | 'content_limit_exceeded'
        | 'version_exhausted'
    }>
  | ContentMergeRetry

export async function saveCanvasContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveCanvasContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'canvas', 'edit')
  if (authorization.status !== 'authorized') {
    return {
      status: 'rejected',
      reason: authorization.reason === 'unauthorized' ? 'unauthorized' : 'content_corrupt',
    }
  }
  const resourceId = args.resourceId
  const content = await loadCanvasContentDeletion(ctx, resourceId)
  if (!content) return { status: 'rejected', reason: 'content_missing' }

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
  }
  return { status: 'completed', resourceId, update: merged.update, version: merged.version }
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
        destinations: canvasAuthoredDestinations(content.nodes),
      },
    }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}
