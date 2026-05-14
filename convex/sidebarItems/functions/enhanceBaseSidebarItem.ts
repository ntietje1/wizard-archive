import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import { assertSidebarItemColor } from '../validation/color'
import { assertSidebarItemIconName } from '../validation/icon'
import { assertSidebarItemName } from '../validation/name'
import { assertSidebarItemSlug } from '../validation/slug'
import {
  isActiveSidebarItem,
  isTrashedSidebarItem,
  normalizeSidebarItemLifecycle,
} from '../types/status'
import type { AnySidebarItemRow } from '../types/types'
import type { EnhanceSidebarItem, NormalizeSidebarItem } from '../types/baseTypes'
import type { CampaignQueryCtx } from '../../functions'

function normalizeSidebarItemFields<T extends AnySidebarItemRow>(item: T): NormalizeSidebarItem<T> {
  return {
    ...normalizeSidebarItemLifecycle(item),
    name: assertSidebarItemName(item.name),
    iconName: item.iconName === null ? null : assertSidebarItemIconName(item.iconName),
    color: item.color === null ? null : assertSidebarItemColor(item.color),
    slug: assertSidebarItemSlug(item.slug),
  }
}

export async function enhanceBase<T extends AnySidebarItemRow>(
  ctx: CampaignQueryCtx,
  { item }: { item: T },
): Promise<EnhanceSidebarItem<T>> {
  const { membership } = ctx
  const normalizedItem = normalizeSidebarItemFields(item)

  const [shares, bookmark, myPermissionLevel, previewUrl] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', normalizedItem.campaignId).eq('sidebarItemId', normalizedItem._id),
      )
      .collect(),
    ctx.db
      .query('bookmarks')
      .withIndex('by_campaign_member_item', (q) =>
        q
          .eq('campaignId', normalizedItem.campaignId)
          .eq('campaignMemberId', membership._id)
          .eq('sidebarItemId', normalizedItem._id),
      )
      .unique(),
    getSidebarItemPermissionLevel(ctx, { item: normalizedItem }),
    normalizedItem.previewStorageId ? ctx.storage.getUrl(normalizedItem.previewStorageId) : null,
  ])

  return {
    ...normalizedItem,
    shares,
    isBookmarked: bookmark !== null,
    myPermissionLevel,
    previewUrl,
    isActive: isActiveSidebarItem(normalizedItem),
    isTrashed: isTrashedSidebarItem(normalizedItem),
  }
}
