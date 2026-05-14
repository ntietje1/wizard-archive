import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import {
  evaluatePermanentDelete,
  evaluateRestore,
  evaluateTrash,
} from 'convex/sidebarItems/filesystem/capabilities'
import type { OperationSidebarItem } from 'convex/sidebarItems/filesystem/capabilities'
import type { CampaignMemberRole } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'

function actor(role: CampaignMemberRole | undefined) {
  return { role: role ?? CAMPAIGN_MEMBER_ROLE.Player }
}

function canTrashSidebarItems(
  role: CampaignMemberRole | undefined,
  items: Array<OperationSidebarItem>,
) {
  return items.length > 0 && items.every((item) => evaluateTrash(actor(role), item).ok)
}

export function canRestoreSidebarItems(
  role: CampaignMemberRole | undefined,
  items: Array<OperationSidebarItem>,
  targetParentId: Id<'sidebarItems'> | null = null,
) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        evaluateRestore(actor(role), item, {
          parentId: targetParentId,
          parent: null,
        }).ok,
    )
  )
}

export function canDeleteSidebarItemsForever(
  role: CampaignMemberRole | undefined,
  items: Array<OperationSidebarItem>,
) {
  return items.length > 0 && items.every((item) => evaluatePermanentDelete(actor(role), item).ok)
}

export function getSidebarFilesystemCapabilities(
  role: CampaignMemberRole | undefined,
  items: Array<OperationSidebarItem>,
) {
  return {
    canTrash: canTrashSidebarItems(role, items),
    canRestore: canRestoreSidebarItems(role, items),
    canDeleteForever: canDeleteSidebarItemsForever(role, items),
  }
}
