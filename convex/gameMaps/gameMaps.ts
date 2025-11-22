import { requireCampaignMembership } from "../campaigns/campaigns"
import { Id } from "../_generated/dataModel"
import { Ctx } from "../common/types"
import { type GameMap } from "./types"
import { CAMPAIGN_MEMBER_ROLE } from "../campaigns/types"
import { SIDEBAR_ITEM_TYPES } from "../sidebarItems/types"

export const getMap = async (
  ctx: Ctx,
  mapId: Id<'gameMaps'>
): Promise<GameMap> => {
    const map = await ctx.db.get(mapId)
    if (!map) {
      throw new Error('Map not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: map.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
    )

    return {
      ...map,
      type: SIDEBAR_ITEM_TYPES.gameMaps
    }
}