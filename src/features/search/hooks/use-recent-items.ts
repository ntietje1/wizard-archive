import usePersistedState from '~/shared/hooks/usePersistedState'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { logger } from '~/shared/utils/logger'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SearchResult } from '../utils/merge-search-results'

interface RecentEntry {
  slug: string
  timestamp: number
}

const MAX_RECENT_ITEMS = 100

function storageKey(campaignId: string) {
  return `recent-items-${campaignId}`
}

function parseEntries(raw: string | null, key: string): Array<RecentEntry> {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is RecentEntry => typeof e === 'object' && e !== null && typeof e.slug === 'string',
    )
  } catch (error) {
    logger.debug('Failed to parse recent items for key', key, error)
    return []
  }
}

export function addRecentItem(campaignId: string, slug: string) {
  if (!campaignId) return
  const key = storageKey(campaignId)
  try {
    const raw = window.localStorage.getItem(key)
    const entries = parseEntries(raw, key)
    const filtered = entries.filter((e) => e.slug !== slug)
    filtered.unshift({ slug, timestamp: Date.now() })
    const trimmed = filtered.slice(0, MAX_RECENT_ITEMS)
    window.localStorage.setItem(key, JSON.stringify(trimmed))
    window.dispatchEvent(
      new CustomEvent('localStorageChange', {
        detail: { key, newValue: JSON.stringify(trimmed) },
      }),
    )
  } catch (error) {
    logger.debug('Failed to write recent items for key', key, error)
  }
}

export function useRecentItems(): Array<SearchResult> {
  const { campaignId } = useCampaign()
  const { data: items } = useFilteredSidebarItems()

  const [entries] = usePersistedState<Array<RecentEntry>>(
    campaignId ? storageKey(campaignId) : null,
    [],
  )

  const safeItems = items ?? []
  const slugToItem = new Map<string, AnySidebarItem>()
  for (const item of safeItems) {
    slugToItem.set(item.slug, item)
  }

  const results: Array<SearchResult> = []
  for (const entry of entries) {
    const item = slugToItem.get(entry.slug)
    if (item) {
      results.push({
        itemId: item._id,
        item,
        matchType: 'title',
        matchText: null,
      })
    }
  }
  return results
}
