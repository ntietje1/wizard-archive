import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

export function resolveReplacementTarget<
  TCurrent extends Readonly<{ campaignUuid: string; version: unknown }>,
>(
  current: TCurrent | null,
  campaignId: CampaignId,
  expectedVersion: unknown,
):
  | Readonly<{ status: 'resource_unavailable' }>
  | Readonly<{ status: 'content_changed' }>
  | Readonly<{ status: 'ready'; current: TCurrent; version: VersionStamp }> {
  if (!current || current.campaignUuid !== campaignId) {
    return { status: 'resource_unavailable' }
  }
  const version = assertVersionStamp(current.version)
  return versionStampEquals(version, assertVersionStamp(expectedVersion))
    ? { status: 'ready', current, version }
    : { status: 'content_changed' }
}
