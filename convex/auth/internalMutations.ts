import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { purgeExpiredAuthData as purgeExpiredAuthDataFn } from './functions/purgeExpiredAuthData'
import { internal } from '../_generated/api'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { adjustAcceptedMemberCount, beginCampaignDeletion } from '../campaigns/functions/lifecycle'
import { isAssetOwnedByResource } from '../storage/functions/storageReferences'
import { userDeletionStageValidator } from '../users/schema'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { CAMPAIGN_MEMBER_STATUS } from '../../shared/campaigns/types'

const USER_DELETION_BATCH_SIZE = 32
const USER_DELETION_STAGES = [
  'preferences',
  'workspacePreferences',
  'uploads',
  'memberships',
  'profile',
] as const
type UserDeletionStage = (typeof USER_DELETION_STAGES)[number]

export const purgeExpiredAuthData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<void> => {
    return purgeExpiredAuthDataFn(ctx)
  },
})

async function deleteUploadBatch(ctx: MutationCtx, profileId: Id<'userProfiles'>) {
  const uploads = await ctx.db
    .query('fileStorage')
    .withIndex('by_user_storage', (query) => query.eq('userId', profileId))
    .take(USER_DELETION_BATCH_SIZE)
  for (const upload of uploads) {
    const ownedByResource =
      upload.status === 'committed' &&
      (await isAssetOwnedByResource(ctx.db, assertDomainId(DOMAIN_ID_KIND.asset, upload.assetUuid)))
    if (ownedByResource) {
      await ctx.db.patch('fileStorage', upload._id, { userId: null })
    } else {
      if (upload.storageId) await ctx.storage.delete(upload.storageId)
      await ctx.db.delete('fileStorage', upload._id)
    }
  }
  return uploads.length
}

async function deleteMembershipBatch(ctx: MutationCtx, profileId: Id<'userProfiles'>) {
  const memberships = await ctx.db
    .query('campaignMembers')
    .withIndex('by_user', (query) => query.eq('userId', profileId))
    .take(USER_DELETION_BATCH_SIZE)
  for (const membership of memberships) {
    const campaign = await ctx.db.get('campaigns', membership.campaignId)
    if (campaign?.dmUserId === profileId) await beginCampaignDeletion(ctx, campaign)
    if (membership.status === CAMPAIGN_MEMBER_STATUS.Accepted) {
      await adjustAcceptedMemberCount(ctx, membership.campaignId, -1)
    }
    await ctx.db.delete('campaignMembers', membership._id)
  }
  return memberships.length
}

async function processStage(
  ctx: MutationCtx,
  profile: Doc<'userProfiles'>,
  stage: UserDeletionStage,
): Promise<number> {
  switch (stage) {
    case 'preferences': {
      const rows = await ctx.db
        .query('userPreferences')
        .withIndex('by_user', (query) => query.eq('userId', profile._id))
        .take(USER_DELETION_BATCH_SIZE)
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
      return rows.length
    }
    case 'workspacePreferences': {
      const rows = await ctx.db
        .query('workspacePreferences')
        .withIndex('by_user', (query) => query.eq('userId', profile._id))
        .take(USER_DELETION_BATCH_SIZE)
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
      return rows.length
    }
    case 'uploads':
      return await deleteUploadBatch(ctx, profile._id)
    case 'memberships':
      return await deleteMembershipBatch(ctx, profile._id)
    case 'profile':
      await ctx.db.delete('userProfiles', profile._id)
      return 0
  }
}

export const processUserDeletion = internalMutation({
  args: {
    profileId: v.id('userProfiles'),
    stage: userDeletionStageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const profile = await ctx.db.get('userProfiles', args.profileId)
    if (!profile || profile.deletionStage !== args.stage) return null

    const processed = await processStage(ctx, profile, args.stage)
    if (args.stage === 'profile') return null

    const stageIndex = USER_DELETION_STAGES.indexOf(args.stage)
    const nextStage =
      processed === USER_DELETION_BATCH_SIZE ? args.stage : USER_DELETION_STAGES[stageIndex + 1]
    await ctx.db.patch('userProfiles', profile._id, { deletionStage: nextStage })
    await ctx.scheduler.runAfter(0, internal.auth.internalMutations.processUserDeletion, {
      profileId: profile._id,
      stage: nextStage,
    })
    return null
  },
})
