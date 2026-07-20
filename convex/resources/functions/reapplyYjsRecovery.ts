import { YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/content-session-contract'
import type { ContentRecoveryActionResult } from '@wizard-archive/editor/resources/content-session-contract'
import {
  assertContentGeneration,
  INITIAL_CONTENT_GENERATION,
} from '@wizard-archive/editor/resources/content-generation'
import type { ContentGeneration } from '@wizard-archive/editor/resources/content-generation'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { sha256Digest } from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignMutationCtx } from '../../functions'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import { loadCanvasContentDeletion } from './canvasContent'
import { findNoteContent } from './noteContent'
import { queueYjsHistoryCheckpoint } from './itemHistory'
import { replaceCanvasContent } from './replaceCanvasContent'
import { replaceNoteContent } from './replaceNoteContent'
import { jsonContentDigest } from './contentVersion'

export async function reapplyYjsRecovery(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    expectedGeneration: ContentGeneration
    expectedVersion: VersionStamp
    operationId: OperationId
    resourceId: ResourceId
    snapshotUpdate: ArrayBuffer
    snapshotVersion: VersionStamp
  }>,
): Promise<ContentRecoveryActionResult> {
  const [stored, fingerprint] = await Promise.all([
    ctx.db
      .query('yjsRecoveryReapplyOperations')
      .withIndex('by_campaign_and_operation', (query) =>
        query
          .eq('campaignUuid', ctx.resourceScope.campaignId)
          .eq('operationUuid', args.operationId),
      )
      .unique(),
    recoveryFingerprint(args),
  ])
  if (stored) {
    return stored.actorMemberUuid === ctx.resourceScope.actorId &&
      stored.fingerprint === fingerprint
      ? { status: 'completed' }
      : { status: 'rejected', reason: 'operation_id_reused' }
  }

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
  await ctx.db.insert('yjsRecoveryReapplyOperations', {
    campaignUuid: ctx.resourceScope.campaignId,
    actorMemberUuid: ctx.resourceScope.actorId,
    resourceUuid: args.resourceId,
    operationUuid: args.operationId,
    protocolVersion: YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION,
    fingerprint,
  })
  return { status: 'completed' }
}

async function recoveryFingerprint(
  args: Readonly<{
    expectedGeneration: ContentGeneration
    expectedVersion: VersionStamp
    resourceId: ResourceId
    snapshotUpdate: ArrayBuffer
    snapshotVersion: VersionStamp
  }>,
) {
  return await jsonContentDigest({
    protocolVersion: YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION,
    expectedGeneration: args.expectedGeneration,
    expectedVersion: args.expectedVersion,
    resourceId: args.resourceId,
    snapshotDigest: await sha256Digest(new Uint8Array(args.snapshotUpdate)),
    snapshotVersion: args.snapshotVersion,
  })
}
