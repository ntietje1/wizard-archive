import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../types'
import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'
import type { CampaignMemberStatus } from '../types'

export async function updateCampaignMemberStatus(
  ctx: AuthMutationCtx,
  {
    memberId,
    status,
  }: { memberId: Id<'campaignMembers'>; status: CampaignMemberStatus },
): Promise<Id<'campaignMembers'>> {
  const member = await ctx.db.get(memberId)
  if (!member) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Member not found')
  }

  await requireDmRole(ctx, member.campaignId)

  if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'Only player membership status can be changed',
    )
  }

  const now = Date.now()
  await ctx.db.patch(member._id, {
    status,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  return member._id
}
