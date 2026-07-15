import { logger } from '~/shared/utils/logger'
import {
  parsePersistedJson,
  readPersistedJson,
  subscribeToPersistedStorage,
  writePersistedJson,
} from '@wizard-archive/ui/storage/persisted-storage'
import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

const MAX_RECENT_RESOURCES = 100

interface RecentResourceEntry {
  resourceId: ResourceId
  timestamp: number
}

function storageKey(campaignId: CampaignId, actorId: CampaignMemberId) {
  return `recent-resources-v1-${campaignId}-${actorId}`
}

export function addLiveRecentResource(
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  resourceId: ResourceId,
) {
  const key = storageKey(campaignId, actorId)
  try {
    const entries = readPersistedJson(key, [], parseRecentResourceEntries)
    writePersistedJson(key, addRecentResourceEntry({ entries, resourceId }))
  } catch (error) {
    logger.debug('Failed to write recent resources for key', key, error)
  }
}

export function getLiveRecentResources(
  campaignId: CampaignId,
  actorId: CampaignMemberId,
): ReadonlyArray<ResourceId> {
  return readPersistedJson(storageKey(campaignId, actorId), [], parseRecentResourceEntries).map(
    (entry) => entry.resourceId,
  )
}

export function subscribeToLiveRecentResources(
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  listener: () => void,
): () => void {
  return subscribeToPersistedStorage(storageKey(campaignId, actorId), (value) => {
    if (value !== null) parsePersistedJson(value, [], parseRecentResourceEntries)
    listener()
  })
}

function addRecentResourceEntry({
  entries,
  now = Date.now(),
  resourceId,
}: {
  entries: ReadonlyArray<RecentResourceEntry>
  now?: number
  resourceId: ResourceId
}): Array<RecentResourceEntry> {
  return [
    { resourceId, timestamp: now },
    ...entries.filter((entry) => entry.resourceId !== resourceId),
  ].slice(0, MAX_RECENT_RESOURCES)
}

function parseRecentResourceEntries(value: unknown): Array<RecentResourceEntry> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const parsedEntry = parseRecentResourceEntry(entry)
    return parsedEntry ? [parsedEntry] : []
  })
}

function parseRecentResourceEntry(entry: unknown): RecentResourceEntry | null {
  if (typeof entry !== 'object' || entry === null) return null
  const rawResourceId = (entry as { resourceId?: unknown }).resourceId
  const timestamp = (entry as { timestamp?: unknown }).timestamp
  if (typeof rawResourceId !== 'string' || typeof timestamp !== 'number') return null

  const resourceId = parseDomainId(DOMAIN_ID_KIND.resource, rawResourceId)
  return resourceId ? { resourceId, timestamp } : null
}
