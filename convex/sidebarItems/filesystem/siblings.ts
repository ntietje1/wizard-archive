import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
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
    name: ResourceTitle
  },
): Promise<Doc<'sidebarItems'> | null> {
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })

  return siblings.find((item) => canonicalizeResourceTitle(item.name) === name) ?? null
}
