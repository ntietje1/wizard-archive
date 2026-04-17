import type { ParsedCreateParentTarget } from '../../sidebarItems/validation/parent'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
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
