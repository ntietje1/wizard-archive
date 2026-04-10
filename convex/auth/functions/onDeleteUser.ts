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
  const now = Date.now()

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

  await Promise.all([
    ...prefs.map((p) => ctx.db.delete('userPreferences', p._id)),
    ...editors.map((e) => ctx.db.delete('editor', e._id)),
    ...files.map(async (f) => {
      await ctx.storage.delete(f.storageId)
      await ctx.db.delete('fileStorage', f._id)
    }),
  ])

  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (q) => q.eq('userId', profileId))
    .collect()

  for (const member of memberships) {
    if (member.deletionTime) continue

    const campaignId = member.campaignId

    const campaign = await ctx.db.get('campaigns', campaignId)
    if (campaign && !campaign.deletionTime && campaign.dmUserId === profileId) {
      await ctx.db.patch('campaigns', campaign._id, {
        deletionTime: now,
        deletedBy: profileId,
        updatedTime: now,
        updatedBy: profileId,
      })
    }

    const [sidebarShares, blockShares] = await Promise.all([
      ctx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_member', (q) =>
          q.eq('campaignId', campaignId).eq('campaignMemberId', member._id),
        )
        .filter((q) => q.eq(q.field('deletionTime'), null))
        .collect(),
      ctx.db
        .query('blockShares')
        .withIndex('by_campaign_member', (q) =>
          q.eq('campaignId', campaignId).eq('campaignMemberId', member._id),
        )
        .filter((q) => q.eq(q.field('deletionTime'), null))
        .collect(),
    ])

    const softDelete = {
      deletionTime: now,
      deletedBy: profileId,
      updatedTime: now,
      updatedBy: profileId,
    }

    await Promise.all([
      ...sidebarShares.map((s) => ctx.db.patch('sidebarItemShares', s._id, softDelete)),
      ...blockShares.map((s) => ctx.db.patch('blockShares', s._id, softDelete)),
      ctx.db.patch('campaignMembers', member._id, softDelete),
    ])
  }

  await ctx.db.delete('userProfiles', profileId)
}
