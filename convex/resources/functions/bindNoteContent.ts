import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { initialBinaryContentVersion } from './contentVersion'
import {
  NOTE_YJS_FRAGMENT,
  decodeNoteYjsUpdatesToBlocks,
} from '@wizard-archive/editor/notes/document-yjs'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'
import { findNoteContent } from './noteContent'

export type BindNoteContentResult =
  | {
      status: 'completed'
      resourceId: ResourceId
      version: Awaited<ReturnType<typeof initialBinaryContentVersion>>
    }
  | {
      status: 'rejected'
      reason:
        | 'invalid_uuid'
        | 'resource_missing'
        | 'ownership_mismatch'
        | 'wrong_kind'
        | 'operation_mismatch'
        | 'content_missing'
        | 'content_corrupt'
        | 'already_initialized'
    }

export async function bindNoteContent(
  ctx: CampaignMutationCtx,
  args: { resourceId: string; operationId: string; update: ArrayBuffer },
): Promise<BindNoteContentResult> {
  let resourceId: ResourceId
  let operationId: OperationId
  try {
    resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
    operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }

  const campaignId = ctx.resourceScope.campaignId
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource) return { status: 'rejected', reason: 'resource_missing' }
  if (resource.campaignUuid !== campaignId) {
    return { status: 'rejected', reason: 'ownership_mismatch' }
  }
  if (resource.kind !== 'note') return { status: 'rejected', reason: 'wrong_kind' }

  const operation = await ctx.db
    .query('resourceOperations')
    .withIndex('by_campaign_and_operation', (query) =>
      query.eq('campaignUuid', campaignId).eq('operationUuid', operationId),
    )
    .unique()
  if (
    !operation ||
    operation.actorMemberUuid !== ctx.resourceScope.actorId ||
    operation.receipt.result.type !== 'created' ||
    operation.receipt.result.resourceId !== resourceId
  ) {
    return { status: 'rejected', reason: 'operation_mismatch' }
  }

  const content = await findNoteContent(ctx.db, resourceId)
  if (!content) return { status: 'rejected', reason: 'content_missing' }
  if (content.initializationOperationUuid !== operationId) {
    return { status: 'rejected', reason: 'operation_mismatch' }
  }

  let version
  try {
    decodeNoteYjsUpdatesToBlocks([{ update: args.update }], NOTE_YJS_FRAGMENT)
    version = await initialBinaryContentVersion(args.update)
  } catch {
    return { status: 'rejected', reason: 'content_corrupt' }
  }
  if (content.state === 'ready') {
    return content.version.digest === version.digest
      ? { status: 'completed', resourceId, version: assertVersionStamp(content.version) }
      : { status: 'rejected', reason: 'already_initialized' }
  }

  const intents = await ctx.db
    .query('resourceNoteInitializationIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .take(2)
  if (
    intents.length !== 1 ||
    intents[0]!.operationUuid !== operationId ||
    intents[0]!.campaignUuid !== campaignId
  ) {
    return { status: 'rejected', reason: 'content_missing' }
  }

  await ctx.db.replace('resourceNoteContents', content._id, {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    state: 'ready',
    initializationOperationUuid: operationId,
    update: args.update,
    version,
  })
  await ctx.db.delete(intents[0]!._id)
  return { status: 'completed', resourceId, version }
}
