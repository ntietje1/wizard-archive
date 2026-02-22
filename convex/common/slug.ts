import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/baseTypes'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

/**
 * Returns a slug basis from a name, falling back to a random UUID if empty.
 */
export function resolveSlugBasis(name?: string): string {
  return name && name.trim() !== '' ? name.trim() : crypto.randomUUID()
}

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  // Replace whitespace/underscores with hyphen
  const withHyphens = lower.replace(/[\s_]+/g, '-')
  // Remove all non a-z0-9-
  const cleaned = withHyphens.replace(/[^a-z0-9-]/g, '')
  // Collapse multiple hyphens
  const collapsed = cleaned.replace(/-+/g, '-')
  // Trim leading/trailing hyphens
  return collapsed.replace(/^-+/, '').replace(/-+$/, '')
}

export function appendSuffix(base: string, n: number): string {
  return n <= 1 ? base : `${base}-${n}`
}

export function shortenId(id: string, length: number = 8): string {
  return id.slice(0, length)
}

export async function findUniqueSlug(
  name: string,
  checkFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  const normalized = slugify(name)
  let uniqueSlug = normalized
  let suffix = 1
  for (let i = 0; i < 100; i++) {
    // 100 max checks
    const conflict = await checkFn(uniqueSlug)
    if (!conflict) break
    suffix += 1
    uniqueSlug = appendSuffix(normalized, suffix)
  }
  const finalConflict = await checkFn(uniqueSlug)
  if (finalConflict) {
    throw new Error(`Failed to find unique slug for: ${name}`)
  }
  return uniqueSlug
}

export async function findUniqueSidebarItemSlug(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  type: SidebarItemType,
  name: string | undefined,
  itemId: SidebarItemId,
): Promise<string> {
  const slugBasis = name && name.trim() !== '' ? name : shortenId(itemId)

  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('notes')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== itemId
      })
    case SIDEBAR_ITEM_TYPES.folders:
      return findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('folders')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== itemId
      })
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('gameMaps')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== itemId
      })
    case SIDEBAR_ITEM_TYPES.files:
      return findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('files')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== itemId
      })
    default:
      throw new Error(`Unknown sidebar item type: ${type}`)
  }
}
