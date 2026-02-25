import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess, validateSidebarItemRename } from '../validation'
import type { SidebarItemId } from '../types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'

export async function updateSidebarItem(
  ctx: CampaignMutationCtx,
  {
    itemId,
    name,
    iconName,
    color,
  }: {
    itemId: SidebarItemId
    name?: string
    iconName?: string | null
    color?: string | null
  },
): Promise<{ slug: string }> {
  const itemFromDb = await ctx.db.get(itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<{
    name: string
    slug: string
    iconName: string | null
    color: string | null
  }> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item,
      newName: trimmedName,
    })
    updates.slug = newSlug
  }
  if (iconName !== undefined) {
    updates.iconName = iconName
  }
  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    return { slug: item.slug }
  }

  await ctx.db.patch(itemId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return { slug: newSlug ?? item.slug }
}
