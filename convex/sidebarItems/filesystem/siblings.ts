import { normalizeResourceNameForComparison } from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceName } from '@wizard-archive/editor/resources/resource-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { getActiveSidebarItemRowsByParent } from '../functions/getSidebarItemsByParent'

export async function findActiveSidebarChildByName(
  ctx: CampaignMutationCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: ResourceName
  },
): Promise<Doc<'sidebarItems'> | null> {
  const normalizedName = normalizeResourceNameForComparison(name)
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })

  return (
    siblings.find((item) => normalizeResourceNameForComparison(item.name) === normalizedName) ??
    null
  )
}
