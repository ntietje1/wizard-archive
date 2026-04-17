import { getSidebarItem } from './getSidebarItem'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { checkItemAccess } from '../validation/access'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemWithContent,
  WithContentBySidebarItemType,
} from '../types/types'
import type { SidebarItemType } from '../types/baseTypes'

function isSidebarItemOfType<T extends SidebarItemType>(
  item: AnySidebarItem,
  expectedType: T,
): item is Extract<AnySidebarItem, { type: T }> {
  return item.type === expectedType
}

export async function getSidebarItemWithContent(
  ctx: CampaignQueryCtx,
  id: Id<'sidebarItems'>,
): Promise<AnySidebarItemWithContent | null>
export async function getSidebarItemWithContent<T extends SidebarItemType>(
  ctx: CampaignQueryCtx,
  id: Id<'sidebarItems'>,
  expectedType: T,
): Promise<WithContentBySidebarItemType<T> | null>
export async function getSidebarItemWithContent<T extends SidebarItemType>(
  ctx: CampaignQueryCtx,
  id: Id<'sidebarItems'>,
  expectedType?: T,
): Promise<AnySidebarItemWithContent | null> {
  const item = await getSidebarItem(ctx, id)
  if (!item) return null
  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null

  if (expectedType !== undefined && !isSidebarItemOfType(enhanced, expectedType)) {
    return null
  }

  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
