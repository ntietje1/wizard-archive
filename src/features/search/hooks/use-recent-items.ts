import usePersistedState from '~/shared/hooks/usePersistedState'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { logger } from '~/shared/utils/logger'
import { readPersistedJson, writePersistedJson } from '~/shared/storage/persisted-storage'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { parseSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { SearchResult } from '../utils/merge-search-results'

interface RecentEntry {
  slug: SidebarItemSlug
  timestamp: number
}

const MAX_RECENT_ITEMS = 100

function storageKey(campaignId: string) {
  return `recent-items-${campaignId}`
}

function isRecentEntry(e: unknown): e is RecentEntry {
  if (typeof e !== 'object' || e === null) return false
  const rawSlug = (e as { slug?: unknown }).slug
  const slug = typeof rawSlug === 'string' ? parseSidebarItemSlug(rawSlug) : null
  return slug !== null && typeof (e as { timestamp?: unknown }).timestamp === 'number'
}

function parseRecentEntry(entry: unknown): RecentEntry | null {
  if (typeof entry !== 'object' || entry === null) return null
  const rawSlug = (entry as { slug?: unknown }).slug
  const timestamp = (entry as { timestamp?: unknown }).timestamp
  if (typeof rawSlug !== 'string' || typeof timestamp !== 'number') return null

  const slug = parseSidebarItemSlug(rawSlug)
  if (!slug) return null

  return { slug, timestamp }
}

function parseEntries(value: unknown): Array<RecentEntry> | null {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const parsedEntry = parseRecentEntry(entry)
    return parsedEntry ? [parsedEntry] : []
  })
}

export function addRecentItem(campaignId: string, slug: SidebarItemSlug) {
  if (!campaignId) return
  const key = storageKey(campaignId)
  try {
    const entries = readPersistedJson(key, [], parseEntries)
    const filtered = entries.filter((e) => e.slug !== slug)
    filtered.unshift({ slug, timestamp: Date.now() })
    const trimmed = filtered.slice(0, MAX_RECENT_ITEMS)
    writePersistedJson(key, trimmed)
  } catch (error) {
    logger.debug('Failed to write recent items for key', key, error)
  }
}

export function useRecentItems(items: Array<AnySidebarItem>): Array<SearchResult> {
  const { campaignId } = useCampaign()

  const [entries] = usePersistedState<Array<RecentEntry>>(
    campaignId ? storageKey(campaignId) : null,
    [],
  )

  const slugToItem = new Map<SidebarItemSlug, AnySidebarItem>()
  for (const item of items) {
    slugToItem.set(item.slug, item)
  }

  const validEntries = Array.isArray(entries) ? entries.filter(isRecentEntry) : []

  const results: Array<SearchResult> = []
  for (const entry of validEntries) {
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
