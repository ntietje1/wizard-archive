import usePersistedState from '~/shared/hooks/usePersistedState'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { logger } from '~/shared/utils/logger'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { parseSidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
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

function parseEntries(raw: string | null, key: string): Array<RecentEntry> {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const parsedEntry = parseRecentEntry(entry)
      return parsedEntry ? [parsedEntry] : []
    })
  } catch (error) {
    logger.debug('Failed to parse recent items for key', key, error)
    return []
  }
}

export function addRecentItem(campaignId: string, slug: SidebarItemSlug) {
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
  const slugToItem = new Map<SidebarItemSlug, AnySidebarItem>()
  for (const item of safeItems) {
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
