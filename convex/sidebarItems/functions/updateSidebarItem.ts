import { PERMISSION_LEVEL } from '../../shares/types'
import { requireItemAccess, validateSidebarItemRename } from '../validation'
import type { Id } from '../../_generated/dataModel'
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

  const patch: {
    name?: string
    slug?: string
    iconName?: string | undefined
    color?: string | undefined
    _updatedTime: number
    _updatedBy: Id<'userProfiles'>
  } = {
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    patch.name = name
    patch.slug = await validateSidebarItemRename(ctx, { item, newName: name })
  }
  if (iconName !== undefined) {
    patch.iconName = iconName ?? undefined
  }
  if (color !== undefined) {
    patch.color = color ?? undefined
  }

  await ctx.db.patch(itemId, patch)

  return { slug: patch.slug ?? item.slug }
}
