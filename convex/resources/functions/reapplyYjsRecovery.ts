import type { ContentRecoveryActionResult } from '@wizard-archive/editor/resources/content-session-contract'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import { loadCanvasContentDeletion } from './canvasContent'
import { findNoteContent } from './noteContent'
import { queueYjsHistoryCheckpoint } from './itemHistory'
import { replaceCanvasContent } from './replaceCanvasContent'
import { replaceNoteContent } from './replaceNoteContent'

export async function reapplyYjsRecovery(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    expectedGeneration: ContentGeneration
    expectedVersion: VersionStamp
    resourceId: ResourceId
    snapshotUpdate: ArrayBuffer
    snapshotVersion: VersionStamp
  }>,
): Promise<ContentRecoveryActionResult> {
  const authorization = await authorizeResourceContentKinds(
    ctx,
    args.resourceId,
    ['note', 'canvas'],
    'edit',
  )
  if (authorization.status !== 'authorized') {
    return {
      status: 'rejected',
      reason: authorization.reason === 'unauthorized' ? 'unauthorized' : 'resource_unavailable',
    }
  }
  const current =
    authorization.resource.kind === 'note'
      ? await findNoteContent(ctx.db, args.resourceId)
      : await loadCanvasContentDeletion(ctx, args.resourceId)
  if (
    !current ||
    assertContentGeneration(current.generation ?? INITIAL_CONTENT_GENERATION) !==
      args.expectedGeneration
  ) {
    return { status: 'rejected', reason: 'content_changed' }
  }
  const replacement =
    authorization.resource.kind === 'note'
      ? await replaceNoteContent(ctx, args)
      : await replaceCanvasContent(ctx, args)
  if (replacement.status !== 'completed') {
    return { status: 'rejected', reason: replacement.status }
  }
  await queueYjsHistoryCheckpoint(ctx, args.resourceId, replacement.version)
  return { status: 'completed' }
}
