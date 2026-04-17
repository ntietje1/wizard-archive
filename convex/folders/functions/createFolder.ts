import type { ParsedCreateParentTarget } from '../../sidebarItems/createParentTarget'
import type { SidebarItemName } from '../../sidebarItems/sharedValidation'
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
    iconName?: string
    color?: string
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
