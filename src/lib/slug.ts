import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  const withHyphens = lower.replace(/[\s_]+/g, '-')
  const cleaned = withHyphens.replace(/[^a-z0-9-]/g, '')
  const collapsed = cleaned.replace(/-+/g, '-')
  return collapsed.replace(/^-+/, '').replace(/-+$/, '')
}

export function appendSuffix(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}

/**
 * Generates a unique slug from the collection state.
 * Builds a set of existing slugs for the same type+campaign and finds a non-conflicting one.
 * Pass excludeId to skip the item being renamed (so it doesn't conflict with itself).
 */
export function findUniqueSlugFromCollection(
  name: string | undefined,
  type: SidebarItemType,
  campaignId: Id<'campaigns'>,
  collectionState: Map<string, AnySidebarItem>,
  excludeId?: SidebarItemId,
): string {
  const slugBasis = name && name.trim() !== '' ? name : crypto.randomUUID()

  const existingSlugs = new Set<string>()
  for (const item of collectionState.values()) {
    if (
      item.type === type &&
      item.campaignId === campaignId &&
      item._id !== excludeId
    ) {
      existingSlugs.add(item.slug)
    }
  }

  const normalized = slugify(slugBasis)
  const baseSlug = normalized || 'item'
  let uniqueSlug = baseSlug
  let suffix = 1
  while (existingSlugs.has(uniqueSlug) && suffix < 100) {
    suffix += 1
    uniqueSlug = appendSuffix(baseSlug, suffix)
  }
  if (existingSlugs.has(uniqueSlug)) {
    throw new Error(
      `Could not generate unique slug for "${name}" after 100 attempts`,
    )
  }
  return uniqueSlug

  return uniqueSlug
}
