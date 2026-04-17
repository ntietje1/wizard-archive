import type { CreateParentTarget } from '../../sidebarItems/createParentTarget'
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
    name: string
    parentTarget: CreateParentTarget
    iconName?: string
    color?: string
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const trimmedName = name.trim()
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })

  return await insertFolder(ctx, {
    name: trimmedName,
    parentId: resolvedParentId,
    iconName,
    color,
  })
}
