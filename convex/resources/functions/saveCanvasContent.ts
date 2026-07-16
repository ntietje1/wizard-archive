import * as Y from 'yjs'
import { canonicalizeCanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import {
  advanceVersion,
  assertVersionStamp,
  sha256Digest,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadCanvasContentDeletion } from './canvasContent'
import { contentMergeRejection } from './contentVersion'
import type { ContentMergeRejection } from './contentVersion'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'

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

export async function saveCanvasContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; update: ArrayBuffer },
): Promise<SaveCanvasContentResult> {
  const authorization = await authorizeResourceContent(ctx, args.resourceId, 'canvas')
  if (authorization.status !== 'authorized') {
    return {
      status: 'rejected',
      reason: authorization.reason === 'unauthorized' ? 'unauthorized' : 'content_corrupt',
    }
  }
  const resourceId = args.resourceId
  const content = await loadCanvasContentDeletion(ctx, resourceId)
  if (!content) return { status: 'rejected', reason: 'content_missing' }

  const merged = await mergeCanvasUpdate(content.update, args.update, content.version)
  if (merged.status === 'rejected') return merged
  if (merged.version.digest !== content.version.digest) {
    await ctx.db.patch('resourceCanvasContents', content._id, {
      update: merged.update,
      version: merged.version,
    })
  }
  return { status: 'completed', resourceId, update: merged.update, version: merged.version }
}

async function mergeCanvasUpdate(
  current: ArrayBuffer,
  delta: ArrayBuffer,
  currentVersion: unknown,
): Promise<
  | Readonly<{ status: 'completed'; update: ArrayBuffer; version: VersionStamp }>
  | ContentMergeRejection
  | Readonly<{ status: 'rejected'; reason: 'content_limit_exceeded' }>
> {
  if (!canvasEncodedBytesWithinWorkload(current) || !canvasEncodedBytesWithinWorkload(delta)) {
    return { status: 'rejected', reason: 'content_limit_exceeded' }
  }
  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(current))
    Y.applyUpdate(document, new Uint8Array(delta))
    if (!canonicalizeCanvasDocumentContent(document)) {
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
    return { status: 'completed', update, version }
  } catch (error) {
    return contentMergeRejection(error)
  } finally {
    document.destroy()
  }
}
