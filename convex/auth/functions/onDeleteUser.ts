import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../campaigns/types'
import type { MutationCtx } from '../../_generated/server'

type AuthUserDoc = {
  _id: string
  _creationTime: number
}

export async function onDeleteUser(ctx: MutationCtx, user: AuthUserDoc): Promise<void> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', user._id))
    .unique()
  if (!profile) return

  const profileId = profile._id

  const [prefs, editors, files] = await Promise.all([
    ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', profileId))
      .collect(),
    ctx.db
      .query('editor')
      .withIndex('by_user', (q) => q.eq('userId', profileId))
      .collect(),
    ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) => q.eq('userId', profileId))
      .collect(),
  ])

  await asyncMap(prefs, (p) => ctx.db.delete('userPreferences', p._id))
  await asyncMap(editors, (e) => ctx.db.delete('editor', e._id))
  await asyncMap(files, async (f) => {
    await ctx.storage.delete(f.storageId)
    await ctx.db.delete('fileStorage', f._id)
  })

  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (q) => q.eq('userId', profileId))
    .collect()

  for (const member of memberships) {
    if (member.status === CAMPAIGN_MEMBER_STATUS.Removed) continue

    const campaignId = member.campaignId

    const campaign = await ctx.db.get('campaigns', campaignId)
    if (
      campaign &&
      campaign.status !== CAMPAIGN_STATUS.Deleted &&
      campaign.dmUserId === profileId
    ) {
      await ctx.db.patch('campaigns', campaign._id, {
        status: CAMPAIGN_STATUS.Deleted,
      })
    }

    const [sidebarShares, blockShares] = await Promise.all([
      ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_member', (q) =>
          q.eq('campaignId', campaignId).eq('campaignMemberId', member._id),
        )
        .collect(),
      ctx.db
        .query('blockShares')
        .withIndex('by_campaign_member', (q) =>
          q.eq('campaignId', campaignId).eq('campaignMemberId', member._id),
        )
        .collect(),
    ])

    await asyncMap(sidebarShares, (s) => ctx.db.delete('sidebarItemShares', s._id))
    await asyncMap(blockShares, (s) => ctx.db.delete('blockShares', s._id))
    await ctx.db.patch('campaignMembers', member._id, {
      status: CAMPAIGN_MEMBER_STATUS.Removed,
    })
  }

  await ctx.db.delete('userProfiles', profileId)
}
