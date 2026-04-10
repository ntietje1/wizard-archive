import { getSidebarItem } from './getSidebarItem'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { checkItemAccess } from '../validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemTypeKey, WithContentByType } from '../types/types'

export async function getSidebarItemWithContent<K extends SidebarItemTypeKey = SidebarItemTypeKey>(
  ctx: AuthQueryCtx,
  id: Id<'sidebarItems'>,
): Promise<WithContentByType[K] | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item) return null
  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null
  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
