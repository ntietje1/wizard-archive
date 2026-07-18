import type {
  ResourceAssetsFolderGateway,
  ResourceAssetsFolderResolution,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

type EnsureResourceAssetsFolder = (args: {
  campaignId: CampaignId
  operationId: OperationId
  resourceId: ResourceId
}) => Promise<ResourceAssetsFolderResolution>

export function createLiveResourceAssetsFolderGateway(
  campaignId: CampaignId,
  execute: EnsureResourceAssetsFolder,
): ResourceAssetsFolderGateway {
  let pending: Promise<ResourceAssetsFolderResolution> | null = null
  return {
    ensure: () => {
      if (pending) return pending
      pending = execute({
        campaignId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
      }).finally(() => {
        pending = null
      })
      return pending
    },
  }
}
