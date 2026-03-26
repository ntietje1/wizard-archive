import type { MutationCtx } from '../../_generated/server'

type AuthUserDoc = {
  _id: string
  _creationTime: number
}

export async function onDeleteUser(
  ctx: MutationCtx,
  user: AuthUserDoc,
): Promise<void> {
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
    ...prefs.map((p) => ctx.db.delete(p._id)),
    ...editors.map((e) => ctx.db.delete(e._id)),
    ...files.map(async (f) => {
      await ctx.storage.delete(f.storageId)
      await ctx.db.delete(f._id)
    }),
  ])

  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (q) => q.eq('userId', profileId))
    .collect()

  for (const member of memberships) {
    if (member.deletionTime) continue

    const campaign = await ctx.db.get(member.campaignId)
    if (campaign && !campaign.deletionTime && campaign.dmUserId === profileId) {
      await ctx.db.patch(campaign._id, {
        deletionTime: now,
        deletedBy: profileId,
        updatedTime: now,
        updatedBy: profileId,
      })
    }

    await ctx.db.patch(member._id, {
      deletionTime: now,
      deletedBy: profileId,
      updatedTime: now,
      updatedBy: profileId,
    })
  }

  await ctx.db.delete(profileId)
}
