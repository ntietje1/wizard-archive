import type { ParsedCreateParentTarget } from '../../sidebarItems/createParentTarget'
import type { SidebarItemName } from '../../sidebarItems/sharedValidation'
import type { SidebarItemColor } from '../../sidebarItems/color'
import type { SidebarItemIconName } from '../../sidebarItems/icon'
import type { SidebarItemSlug } from '../../sidebarItems/slug'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { resolveOrCreateFolderPath } from './resolveOrCreateFolderPath'
import { insertFolder } from './folderHelpers'

export async function createFolder(
  ctx: CampaignMutationCtx,
  {
    name,
    parentTarget,
    iconName,
    color,
  }: {
    name: SidebarItemName
    parentTarget: ParsedCreateParentTarget
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })

  return await insertFolder(ctx, {
    name,
    parentId: resolvedParentId,
    iconName,
    color,
  })
}
