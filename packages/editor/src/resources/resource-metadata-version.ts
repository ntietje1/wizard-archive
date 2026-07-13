import { advanceVersion, initialVersion, sha256Digest, successorVersion } from './component-version'
import type { VersionStamp } from './component-version'
import type { CampaignId, ResourceId } from './domain-id'
import type { ResourceMetadataValue } from './resource-contract'

export type ResourceTombstone = Readonly<{
  resourceId: ResourceId
  campaignId: CampaignId
  deletionVersion: VersionStamp
  deletedAt: number
}>

const textEncoder = new TextEncoder()

export function encodeResourceMetadata(value: ResourceMetadataValue): Uint8Array {
  return textEncoder.encode(
    JSON.stringify({
      parentId: value.parentId,
      kind: value.kind,
      title: value.title,
      icon: value.icon,
      color: value.color,
      lifecycle: value.lifecycle,
    }),
  )
}

export async function digestResourceMetadata(
  value: ResourceMetadataValue,
): Promise<VersionStamp['digest']> {
  return await sha256Digest(encodeResourceMetadata(value))
}

export async function initialResourceMetadataVersion(
  value: ResourceMetadataValue,
): Promise<VersionStamp> {
  return initialVersion(await digestResourceMetadata(value))
}

export async function advanceResourceMetadataVersion(
  current: VersionStamp,
  value: ResourceMetadataValue,
): Promise<VersionStamp> {
  return advanceVersion(current, await digestResourceMetadata(value))
}

export function encodeResourceTombstone(
  resourceId: ResourceId,
  campaignId: CampaignId,
): Uint8Array {
  return textEncoder.encode(JSON.stringify({ resourceId, campaignId, state: 'deleted' }))
}

export async function createResourceTombstone(
  resourceId: ResourceId,
  campaignId: CampaignId,
  finalMetadataVersion: VersionStamp,
  deletedAt: number,
): Promise<ResourceTombstone> {
  const digest = await sha256Digest(encodeResourceTombstone(resourceId, campaignId))
  return {
    resourceId,
    campaignId,
    deletionVersion: successorVersion(finalMetadataVersion, digest),
    deletedAt,
  }
}
