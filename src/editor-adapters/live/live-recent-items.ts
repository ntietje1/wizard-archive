import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { logger } from '~/shared/utils/logger'
import { readPersistedJson, writePersistedJson } from '@wizard-archive/ui/storage/persisted-storage'
import { parseWizardEditorResourceSlug } from '@wizard-archive/editor/adapter'
import type { WizardEditorItem, WizardEditorResourceSlug } from '@wizard-archive/editor/adapter'

const MAX_RECENT_ITEMS = 100

interface RecentItemEntry {
  slug: WizardEditorResourceSlug
  timestamp: number
}

function storageKey(workspaceRecordId: string) {
  return `recent-items-${workspaceRecordId}`
}

export function addLiveRecentItem(workspaceRecordId: string, slug: WizardEditorResourceSlug) {
  if (!workspaceRecordId) return
  const key = storageKey(workspaceRecordId)
  try {
    const entries = readPersistedJson(key, [], parseRecentItemEntries)
    writePersistedJson(key, addRecentItemEntry({ entries, slug }))
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
  slug,
}: {
  entries: ReadonlyArray<RecentItemEntry>
  now?: number
  slug: WizardEditorResourceSlug
}): Array<RecentItemEntry> {
  return [{ slug, timestamp: now }, ...entries.filter((entry) => entry.slug !== slug)].slice(
    0,
    MAX_RECENT_ITEMS,
  )
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
  const rawSlug = (entry as { slug?: unknown }).slug
  const timestamp = (entry as { timestamp?: unknown }).timestamp
  if (typeof rawSlug !== 'string' || typeof timestamp !== 'number') return null

  const slug = parseWizardEditorResourceSlug(rawSlug)
  return slug ? { slug, timestamp } : null
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
  const slugToItem = new Map<WizardEditorResourceSlug, WizardEditorItem>()
  for (const item of items) {
    slugToItem.set(item.slug, item)
  }

  const results: Array<T> = []
  for (const entry of entries) {
    const item = slugToItem.get(entry.slug)
    if (item) {
      results.push(mapItem(item))
    }
  }
  return results
}
