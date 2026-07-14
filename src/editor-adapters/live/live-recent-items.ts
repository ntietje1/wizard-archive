import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { logger } from '~/shared/utils/logger'
import { readPersistedJson, writePersistedJson } from '@wizard-archive/ui/storage/persisted-storage'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

const MAX_RECENT_ITEMS = 100

interface RecentItemEntry {
  resourceId: ResourceId
  timestamp: number
}

function storageKey(workspaceRecordId: string) {
  return `recent-resources-v1-${workspaceRecordId}`
}

export function addLiveRecentItem(workspaceRecordId: string, resourceId: ResourceId) {
  if (!workspaceRecordId) return
  const key = storageKey(workspaceRecordId)
  try {
    const entries = readPersistedJson(key, [], parseRecentItemEntries)
    writePersistedJson(key, addRecentItemEntry({ entries, resourceId }))
  } catch (error) {
    logger.debug('Failed to write recent items for key', key, error)
  }
}

export function useLiveRecentItems<T>(
  items: ReadonlyArray<WizardEditorItem>,
  mapItem: (item: WizardEditorItem) => T,
): Array<T> {
  const { campaignId: workspaceRecordId } = useCampaign()

  const [entries] = usePersistedState<Array<RecentItemEntry>>(
    workspaceRecordId ? storageKey(workspaceRecordId) : null,
    [],
    parseRecentItemEntries,
  )

  return createRecentItemResults({ entries, items, mapItem })
}

function addRecentItemEntry({
  entries,
  now = Date.now(),
  resourceId,
}: {
  entries: ReadonlyArray<RecentItemEntry>
  now?: number
  resourceId: ResourceId
}): Array<RecentItemEntry> {
  return [
    { resourceId, timestamp: now },
    ...entries.filter((entry) => entry.resourceId !== resourceId),
  ].slice(0, MAX_RECENT_ITEMS)
}

function parseRecentItemEntries(value: unknown): Array<RecentItemEntry> {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const parsedEntry = parseRecentItemEntry(entry)
    return parsedEntry ? [parsedEntry] : []
  })
}

function parseRecentItemEntry(entry: unknown): RecentItemEntry | null {
  if (typeof entry !== 'object' || entry === null) return null
  const rawResourceId = (entry as { resourceId?: unknown }).resourceId
  const timestamp = (entry as { timestamp?: unknown }).timestamp
  if (typeof rawResourceId !== 'string' || typeof timestamp !== 'number') return null

  const resourceId = parseDomainId(DOMAIN_ID_KIND.resource, rawResourceId)
  return resourceId ? { resourceId, timestamp } : null
}

function createRecentItemResults<T>({
  entries,
  items,
  mapItem,
}: {
  entries: ReadonlyArray<RecentItemEntry>
  items: ReadonlyArray<WizardEditorItem>
  mapItem: (item: WizardEditorItem) => T
}): Array<T> {
  const itemById = new Map<ResourceId, WizardEditorItem>()
  for (const item of items) {
    itemById.set(item.id, item)
  }

  const results: Array<T> = []
  for (const entry of entries) {
    const item = itemById.get(entry.resourceId)
    if (item) {
      results.push(mapItem(item))
    }
  }
  return results
}
