import * as Y from 'yjs'
import { parseCanvasDocumentContent } from '@wizard-archive/editor/canvas/document-contract'
import {
  advanceVersion,
  assertVersionStamp,
  sha256Digest,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { loadCanvasContentDeletion } from './canvasContent'
import { validateContentResource } from './validateContentResource'

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
        | 'invalid_uuid'
        | 'resource_missing'
        | 'ownership_mismatch'
        | 'wrong_kind'
        | 'content_missing'
        | 'content_corrupt'
        | 'version_exhausted'
    }>

export async function saveCanvasContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: string; update: ArrayBuffer },
): Promise<SaveCanvasContentResult> {
  const validation = await validateContentResource(ctx, args.resourceId, 'canvas')
  if (validation.status === 'rejected') return validation
  const resourceId = validation.resourceId
  const content = await loadCanvasContentDeletion(ctx, resourceId)
  if (!content) return { status: 'rejected', reason: 'content_missing' }

  const document = new Y.Doc()
  try {
    Y.applyUpdate(document, new Uint8Array(content.update))
    Y.applyUpdate(document, new Uint8Array(args.update))
    if (!parseCanvasDocumentContent(document)) {
      return { status: 'rejected', reason: 'content_corrupt' }
    }
    const update = Uint8Array.from(Y.encodeStateAsUpdate(document)).buffer
    const currentVersion = assertVersionStamp(content.version)
    const version = advanceVersion(currentVersion, await sha256Digest(new Uint8Array(update)))
    if (version.digest !== currentVersion.digest) {
      await ctx.db.patch('resourceCanvasContents', content._id, { update, version })
    }
    return { status: 'completed', resourceId, update, version }
  } catch (error) {
    return {
      status: 'rejected',
      reason: error instanceof RangeError ? 'version_exhausted' : 'content_corrupt',
    }
  } finally {
    document.destroy()
  }
}
