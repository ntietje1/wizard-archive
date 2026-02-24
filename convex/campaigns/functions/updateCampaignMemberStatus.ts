import { CAMPAIGN_MEMBER_ROLE } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CampaignMemberStatus } from '../types'

export async function updateCampaignMemberStatus(
  ctx: CampaignMutationCtx,
  {
    memberId,
    status,
  }: { memberId: Id<'campaignMembers'>; status: CampaignMemberStatus },
): Promise<Id<'campaignMembers'>> {
  const member = await ctx.db.get(memberId)
  if (!member || member.campaignId !== ctx.campaign._id) {
    throw new Error('Member not found')
  }

  if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) {
    throw new Error('Only player membership status can be changed')
  }

  const now = Date.now()
  await ctx.db.patch(member._id, {
    status,
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
  })

  return member._id
}
