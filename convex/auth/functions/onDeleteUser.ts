import { asyncMap } from 'convex-helpers'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { removeCampaignMemberForDeletedUser } from '../../campaigns/functions/lifecycle'
import { isAssetOwnedByResource } from '../../storage/functions/storageReferences'
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

  const [prefs, files] = await Promise.all([
    ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', profileId))
      .collect(),
    ctx.db
      .query('fileStorage')
      .withIndex('by_user_storage', (q) => q.eq('userId', profileId))
      .collect(),
  ])

  await asyncMap(prefs, (p) => ctx.db.delete('userPreferences', p._id))
  await asyncMap(files, async (f) => {
    if (
      f.assetUuid &&
      (await isAssetOwnedByResource(ctx.db, assertDomainId(DOMAIN_ID_KIND.asset, f.assetUuid)))
    )
      return
    if (f.storageId) await ctx.storage.delete(f.storageId)
    await ctx.db.delete('fileStorage', f._id)
  })

  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (q) => q.eq('userId', profileId))
    .collect()

  for (const member of memberships) {
    const campaign = await ctx.db.get('campaigns', member.campaignId)
    await removeCampaignMemberForDeletedUser(ctx, {
      campaign,
      deletedUserId: profileId,
      member,
    })
  }

  await ctx.db.delete('userProfiles', profileId)
}
