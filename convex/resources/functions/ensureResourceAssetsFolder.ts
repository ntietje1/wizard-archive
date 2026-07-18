import type { ResourceAssetsFolderResolution } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { OperationId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceStructureCommandResult } from '@wizard-archive/editor/resources/command-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { DmMutationCtx } from '../../functions'
import { executeStructureCommand } from './executeStructureCommand'
import { findCanonicalResource } from './findCanonicalResource'
import { assignResourceAssetsFolder } from './resourceCatalogMetadata'

export async function ensureResourceAssetsFolder(
  ctx: DmMutationCtx,
  args: Readonly<{ operationId: string; resourceId: string }>,
): Promise<ResourceAssetsFolderResolution> {
  let operationId
  let candidateResourceId
  try {
    operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
    candidateResourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }

  const assigned = await resolveAssignedAssetsFolder(ctx, operationId)
  if (assigned) return assigned

  return await createAssetsFolder(ctx, operationId, candidateResourceId)
}

async function resolveAssignedAssetsFolder(
  ctx: DmMutationCtx,
  operationId: OperationId,
): Promise<ResourceAssetsFolderResolution | null> {
  const campaignId = ctx.resourceScope.campaignId
  const assignment = await ctx.db
    .query('resourceAssetsFolders')
    .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
    .unique()
  if (!assignment) return null

  const resourceId = resourceIdFromStoredValue(assignment.resourceUuid)
  if (resourceId === null) return { status: 'rejected', reason: 'integrity_error' }
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource || resource.campaignUuid !== campaignId || resource.kind !== 'folder') {
    return { status: 'rejected', reason: 'integrity_error' }
  }
  if (resource.lifecycle === 'active') {
    return { status: 'completed', resourceId }
  }

  const restored = await executeStructureCommand(ctx, {
    operationId,
    command: { type: 'restore', resourceIds: [resourceId] },
  })
  return commandResolution(restored, resourceId, 'restored')
}

async function createAssetsFolder(
  ctx: DmMutationCtx,
  operationId: OperationId,
  resourceId: ResourceId,
): Promise<ResourceAssetsFolderResolution> {
  const created = await executeStructureCommand(ctx, {
    operationId,
    command: {
      type: 'create',
      resourceId,
      kind: 'folder',
      parentId: null,
      title: canonicalizeResourceTitle('Assets'),
      icon: 'Box',
      color: null,
    },
  })
  const resolution = commandResolution(created, resourceId, 'created')
  if (resolution.status === 'completed') {
    await assignResourceAssetsFolder(ctx, ctx.resourceScope.campaignId, resourceId)
  }
  return resolution
}

function commandResolution(
  result: ResourceStructureCommandResult,
  resourceId: ResourceId,
  expectedResult: 'created' | 'restored',
): ResourceAssetsFolderResolution {
  if (result.status !== 'completed') {
    return { status: 'rejected', reason: result.reason }
  }
  const receiptResult = result.receipt.result
  const matches =
    expectedResult === 'created'
      ? receiptResult.type === 'created' && receiptResult.resourceId === resourceId
      : receiptResult.type === 'restored' && receiptResult.resourceIds.includes(resourceId)
  return matches
    ? { status: 'completed', resourceId }
    : { status: 'rejected', reason: 'integrity_error' }
}

function resourceIdFromStoredValue(value: string): ResourceId | null {
  try {
    return assertDomainId(DOMAIN_ID_KIND.resource, value)
  } catch {
    return null
  }
}
