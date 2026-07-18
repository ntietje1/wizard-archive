import { DOMAIN_ID_KIND, generateDomainId } from './domain-id'
import type { CampaignId, ResourceId } from './domain-id'
import type {
  ResourceAssetsFolderGateway,
  ResourceAssetsFolderResolution,
} from './editor-runtime-contract'
import type {
  CommandDelivery,
  ResourceStructureCommandGateway,
  ResourceStructureCommandResult,
} from './resource-command-contract'
import type { ResourceCatalogSnapshot } from './resource-catalog-contract'
import { canonicalizeResourceTitle } from './resource-record'

type InMemoryResourceAssetsFolderInput = Readonly<{
  campaignId: CampaignId
  readSnapshot: () => ResourceCatalogSnapshot
  execute: ResourceStructureCommandGateway['execute']
  assign: (resourceId: ResourceId) => Promise<void>
}>

export function createInMemoryResourceAssetsFolderGateway(
  input: InMemoryResourceAssetsFolderInput,
): ResourceAssetsFolderGateway {
  let pending: Promise<ResourceAssetsFolderResolution> | null = null
  return {
    ensure: () => {
      if (pending) return pending
      pending = resolveAssetsFolder(input).finally(() => {
        pending = null
      })
      return pending
    },
  }
}

async function resolveAssetsFolder(
  input: InMemoryResourceAssetsFolderInput,
): Promise<ResourceAssetsFolderResolution> {
  const snapshot = input.readSnapshot()
  if (snapshot.assetsFolderId !== null) {
    return await resolveAssignedAssetsFolder(input, snapshot, snapshot.assetsFolderId)
  }
  return await createAssetsFolder(input)
}

async function resolveAssignedAssetsFolder(
  input: InMemoryResourceAssetsFolderInput,
  snapshot: ResourceCatalogSnapshot,
  resourceId: ResourceId,
): Promise<ResourceAssetsFolderResolution> {
  const assigned = snapshot.resources.find((resource) => resource.id === resourceId)
  if (!assigned || assigned.kind !== 'folder') {
    return { status: 'rejected', reason: 'integrity_error' }
  }
  if (assigned.lifecycle.state === 'active') {
    return { status: 'completed', resourceId }
  }
  const delivery = await input.execute({
    campaignId: input.campaignId,
    operationId: generateDomainId(DOMAIN_ID_KIND.operation),
    command: { type: 'restore', resourceIds: [resourceId] },
  })
  return resolutionFromDelivery(delivery, resourceId, 'restored')
}

async function createAssetsFolder(
  input: InMemoryResourceAssetsFolderInput,
): Promise<ResourceAssetsFolderResolution> {
  const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
  const delivery = await input.execute({
    campaignId: input.campaignId,
    operationId: generateDomainId(DOMAIN_ID_KIND.operation),
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
  const resolution = resolutionFromDelivery(delivery, resourceId, 'created')
  if (resolution.status === 'completed') await input.assign(resourceId)
  return resolution
}

function resolutionFromDelivery(
  delivery: CommandDelivery<ResourceStructureCommandResult>,
  resourceId: ResourceId,
  expectedResult: 'created' | 'restored',
): ResourceAssetsFolderResolution {
  if (delivery.status !== 'received') {
    return {
      status: 'rejected',
      reason: delivery.status === 'indeterminate' ? 'dependency_unavailable' : 'scope_unavailable',
    }
  }
  if (delivery.result.status !== 'completed') {
    return { status: 'rejected', reason: delivery.result.reason }
  }
  const result = delivery.result.receipt.result
  const matches =
    expectedResult === 'created'
      ? result.type === 'created' && result.resourceId === resourceId
      : result.type === 'restored' && result.resourceIds.includes(resourceId)
  return matches
    ? { status: 'completed', resourceId }
    : { status: 'rejected', reason: 'integrity_error' }
}
