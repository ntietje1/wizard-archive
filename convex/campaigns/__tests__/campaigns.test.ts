import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  addPlayerToCampaign,
  createCampaignWithDm,
  getCampaignRowId,
  createSession,
} from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectConflict,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  ITEM_HISTORY_ACTION,
  ITEM_HISTORY_RESTORE_PROTOCOL_VERSION,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION } from '@wizard-archive/editor/resources/content-session-contract'
import type { Id } from '../../_generated/dataModel'
import { storeUncommittedTestUploadSession } from '../../_test/storage.helper'

afterEach(() => vi.useRealTimers())

async function acceptedMemberCount(
  t: ReturnType<typeof createTestContext>,
  campaignId: Id<'campaigns'>,
) {
  return await t.run(
    async (ctx) => (await ctx.db.get('campaigns', campaignId))!.acceptedMemberCount,
  )
}

describe('createCampaign', () => {
  const t = createTestContext()

  it('creates a campaign and DM membership', async () => {
    const { authed, profile } = await setupUser(t)

    const campaignId = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'My Campaign',
    })

    expect(campaignId).toBeDefined()
    const campaignRowId = await getCampaignRowId(t, campaignId)

    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignRowId)
      expect(campaign).not.toBeNull()
      expect(campaign!.name).toBe('My Campaign')
      expect(campaign!.description).toBe('')
      expect(campaign!.slug).toBe('my-campaign')
      expect(campaign!.dmUserId).toBe(profile._id)
      expect(campaign!.status).toBe('Active')
      expect(campaign!.acceptedMemberCount).toBe(1)
      expect(isUuidV7(campaign!.campaignUuid)).toBe(true)
      expect(campaign!.assetsFolderUuid).toBeUndefined()
      const campaignResources = await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) =>
          query.eq('campaignUuid', campaign!.campaignUuid).eq('parentResourceUuid', null),
        )
        .take(1)
      expect(campaignResources).toEqual([])

      const members = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignRowId))
        .collect()
      expect(members).toHaveLength(1)
      expect(members[0].role).toBe('DM')
      expect(members[0].status).toBe('Accepted')
      expect(members[0].userId).toBe(profile._id)
      expect(isUuidV7(members[0].campaignMemberUuid)).toBe(true)
    })
    const projection = await authed.query(api.campaigns.queries.getUserCampaigns, {
      paginationOpts: { cursor: null, numItems: 1 },
    })
    expect(projection.page).toHaveLength(1)
    expect(projection.page[0]).not.toHaveProperty('assetsFolderUuid')
  })

  it('validates name minimum length', async () => {
    const { authed } = await setupUser(t)
    await expectValidationFailed(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'ab',
      }),
    )
  })

  it('validates name maximum length', async () => {
    const { authed } = await setupUser(t)
    await expectValidationFailed(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'a'.repeat(31),
      }),
    )
  })

  it('accepts name at exactly 3 characters', async () => {
    const { authed } = await setupUser(t)
    const id = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'abc',
    })
    expect(id).toBeDefined()
  })

  it('accepts name at exactly 30 characters', async () => {
    const { authed } = await setupUser(t)
    const id = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'a'.repeat(30),
    })
    expect(id).toBeDefined()
  })

  it('generates a unique link from the campaign name', async () => {
    const { authed } = await setupUser(t)

    const firstId = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'My Campaign',
    })
    const secondId = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'My Campaign',
    })
    const firstRowId = await getCampaignRowId(t, firstId)
    const secondRowId = await getCampaignRowId(t, secondId)

    const slugs = await t.run(async (ctx) => {
      const campaigns = await Promise.all([ctx.db.get(firstRowId), ctx.db.get(secondRowId)])
      return campaigns.map((campaign) => campaign?.slug)
    })
    expect(slugs).toEqual(['my-campaign', 'my-campaign-1'])
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.createCampaign, {
        name: 'Test',
      }),
    )
  })
})

describe('getUserCampaigns', () => {
  const t = createTestContext()
  const firstPage = { paginationOpts: { cursor: null, numItems: 100 } }

  it('returns only Accepted membership campaigns', async () => {
    const user = await setupUser(t)

    const { campaignDomainId } = await createCampaignWithDm(t, user.profile)

    const { page: campaigns } = await user.authed.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )

    expect(campaigns).toHaveLength(1)
    expect(campaigns[0].id).toBe(campaignDomainId)
  })

  it('paginates every accepted campaign without gaps or duplicates', async () => {
    const user = await setupUser(t)
    await Promise.all(Array.from({ length: 100 }, () => createCampaignWithDm(t, user.profile)))
    const newest = await createCampaignWithDm(t, user.profile)

    const first = await user.authed.query(api.campaigns.queries.getUserCampaigns, {
      paginationOpts: { cursor: null, numItems: 1_000 },
    })
    const second = await user.authed.query(api.campaigns.queries.getUserCampaigns, {
      paginationOpts: { cursor: first.continueCursor, numItems: 1_000 },
    })
    const third = await user.authed.query(api.campaigns.queries.getUserCampaigns, {
      paginationOpts: { cursor: second.continueCursor, numItems: 1_000 },
    })
    const campaigns = [...first.page, ...second.page, ...third.page]

    expect(first.isDone).toBe(false)
    expect(second.isDone).toBe(false)
    expect(third.isDone).toBe(true)
    expect(first.page).toHaveLength(50)
    expect(second.page).toHaveLength(50)
    expect(third.page).toHaveLength(1)
    expect(first.page.some((campaign) => campaign.id === newest.campaignDomainId)).toBe(true)
    expect(campaigns).toHaveLength(101)
    expect(new Set(campaigns.map((campaign) => campaign.id)).size).toBe(101)
    expect(
      campaigns.every(
        (campaign, index) => campaign.createdAt >= (campaigns[index + 1]?.createdAt ?? 0),
      ),
    ).toBe(true)
  })

  it('bounds a maximum page independently of campaign membership history', async () => {
    const bounded = createTestContext()
    const user = await setupUser(bounded)
    const historyUser = await setupUser(bounded)
    const campaigns = await Promise.all(
      Array.from({ length: 50 }, () => createCampaignWithDm(bounded, user.profile)),
    )
    await Promise.all(
      campaigns.map(({ campaignId }) =>
        bounded.run(async (ctx) => {
          for (let index = 0; index < 100; index += 1) {
            await ctx.db.insert('campaignMembers', {
              campaignMemberUuid: generateDomainId(DOMAIN_ID_KIND.campaignMember),
              userId: historyUser.profile._id,
              campaignId,
              role: 'Player',
              status: 'Removed',
            })
          }
        }),
      ),
    )

    const result = await user.authed.query(api.campaigns.queries.getUserCampaigns, {
      paginationOpts: { cursor: null, numItems: 1_000 },
    })

    expect(result.page).toHaveLength(50)
    expect(result.page.every((campaign) => campaign.acceptedMemberCount === 1)).toBe(true)
  })

  it('excludes Pending memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Pending',
    })

    const { page: campaigns } = await user.authed.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )
    expect(campaigns).toHaveLength(0)
  })

  it('excludes Rejected memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Rejected',
    })

    const { page: campaigns } = await user.authed.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )
    expect(campaigns).toHaveLength(0)
  })

  it('excludes Removed memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Removed',
    })

    const { page: campaigns } = await user.authed.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )
    expect(campaigns).toHaveLength(0)
  })

  it('excludes deleted campaigns', async () => {
    const user = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, user.profile)
    await t.run(async (ctx) => {
      await ctx.db.delete('campaigns', campaignId)
    })

    const { page: campaigns } = await user.authed.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )
    expect(campaigns).toHaveLength(0)
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { page: campaigns } = await dmAuth.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )

    expect(campaigns).toHaveLength(1)
    const campaign = campaigns[0]
    expect(campaign.dmUserProfile).toBeDefined()
    expect(campaign).not.toHaveProperty('dmUserId')
    expect(typeof campaign.acceptedMemberCount).toBe('number')
    expect(campaign.myMembership).toBeDefined()
    expect(campaign.myMembership!.id).toBe(ctx.dm.memberDomainId)
  })

  it('returns public campaign profiles without private account fields', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { page: campaigns } = await playerAuth.query(
      api.campaigns.queries.getUserCampaigns,
      firstPage,
    )

    expect(campaigns).toHaveLength(1)
    const campaign = campaigns[0]
    expect(campaign.dmUserProfile).toEqual({
      name: ctx.dm.profile.name,
      username: ctx.dm.profile.username,
      imageUrl: null,
    })
    expect(campaign.dmUserProfile).not.toHaveProperty('authUserId')
    expect(campaign.dmUserProfile).not.toHaveProperty('email')
    expect(campaign.dmUserProfile).not.toHaveProperty('emailVerified')
    expect(campaign.dmUserProfile).not.toHaveProperty('twoFactorEnabled')
    expect(campaign.myMembership?.userProfile).toEqual({
      name: ctx.player.profile.name,
      username: ctx.player.profile.username,
      imageUrl: null,
    })
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('authUserId')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('email')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('emailVerified')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('twoFactorEnabled')
  })

  it('reports accepted campaign members, including the DM membership', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)

    const before = await dm.authed.query(api.campaigns.queries.getUserCampaigns, firstPage)
    expect(before.page.find((campaign) => campaign.id === campaignDomainId)).toMatchObject({
      acceptedMemberCount: 1,
    })

    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile)

    const after = await dm.authed.query(api.campaigns.queries.getUserCampaigns, firstPage)
    expect(after.page.find((campaign) => campaign.id === campaignDomainId)).toMatchObject({
      acceptedMemberCount: 2,
    })
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(t.query(api.campaigns.queries.getUserCampaigns, firstPage))
  })
})

describe('getCampaignBySlug', () => {
  const t = createTestContext()

  it('loads an authorized campaign through its route identity', async () => {
    const dm = await setupUser(t)
    const { campaignDomainId, slug } = await createCampaignWithDm(t, dm.profile)

    const campaign = await dm.authed.query(api.campaigns.queries.getCampaignBySlug, {
      dmUsername: dm.profile.username,
      slug,
    })

    expect(campaign.id).toBe(campaignDomainId)
  })

  it('does not expose a campaign to an actor without membership', async () => {
    const dm = await setupUser(t)
    const outsider = await setupUser(t)
    const { slug } = await createCampaignWithDm(t, dm.profile)

    await expectPermissionDenied(
      outsider.authed.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: dm.profile.username,
        slug,
      }),
    )
  })

  it('requires authentication', async () => {
    const dm = await setupUser(t)
    const { slug } = await createCampaignWithDm(t, dm.profile)

    await expectNotAuthenticated(
      t.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: dm.profile.username,
        slug,
      }),
    )
  })
})

describe('getCampaignInvitation', () => {
  const t = createTestContext()

  it('returns a campaign by its owner and slug without authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const campaign = await t.query(api.campaigns.queries.getCampaignInvitation, {
      dmUsername: ctx.dm.profile.username,
      slug: ctx.slug,
    })

    expect(campaign.id).toBe(ctx.campaignDomainId)
    expect(campaign.dmUserProfile).toBeDefined()
    expect(campaign.myMembership).toBeNull()
  })

  it('returns public DM and membership profiles without private account fields', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const campaign = await playerAuth.query(api.campaigns.queries.getCampaignInvitation, {
      dmUsername: ctx.dm.profile.username,
      slug: ctx.slug,
    })

    expect(campaign.dmUserProfile).toEqual({
      name: ctx.dm.profile.name,
      username: ctx.dm.profile.username,
      imageUrl: null,
    })
    expect(campaign.dmUserProfile).not.toHaveProperty('authUserId')
    expect(campaign.dmUserProfile).not.toHaveProperty('email')
    expect(campaign.dmUserProfile).not.toHaveProperty('emailVerified')
    expect(campaign.dmUserProfile).not.toHaveProperty('twoFactorEnabled')
    expect(campaign.myMembership?.userProfile).toEqual({
      name: ctx.player.profile.name,
      username: ctx.player.profile.username,
      imageUrl: null,
    })
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('authUserId')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('email')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('emailVerified')
    expect(campaign.myMembership?.userProfile).not.toHaveProperty('twoFactorEnabled')
  })

  it('returns NOT_FOUND for a nonexistent campaign slug', async () => {
    const dm = await setupUser(t)
    await expectNotFound(
      t.query(api.campaigns.queries.getCampaignInvitation, {
        dmUsername: dm.profile.username,
        slug: 'missing-campaign',
      }),
    )
  })

  it('returns NOT_FOUND for deleted campaign', async () => {
    const ctx = await setupCampaignContext(t)

    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('campaigns', ctx.campaignId)
    })

    await expectNotFound(
      t.query(api.campaigns.queries.getCampaignInvitation, {
        dmUsername: ctx.dm.profile.username,
        slug: ctx.slug,
      }),
    )
  })
})

describe('getMembersByCampaign', () => {
  const t = createTestContext()

  it('returns only Accepted members with profiles', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.length).toBeGreaterThanOrEqual(2)
    for (const member of members) {
      expect(member.status).toBe('Accepted')
      expect(member.userProfile).toBeDefined()
      expect(member.userProfile.username).toBeDefined()
    }
  })

  it('returns actor-safe public member profiles without private account fields', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const members = await playerAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.length).toBeGreaterThanOrEqual(2)
    for (const member of members) {
      expect(member.userProfile).toEqual({
        name: expect.any(String),
        username: expect.any(String),
        imageUrl: null,
      })
      expect(member.userProfile).not.toHaveProperty('authUserId')
      expect(member.userProfile).not.toHaveProperty('email')
      expect(member.userProfile).not.toHaveProperty('emailVerified')
      expect(member.userProfile).not.toHaveProperty('twoFactorEnabled')
    }
  })

  it('excludes Pending members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const newPlayer = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, { status: 'Pending' })

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.find((m) => m.userId === newPlayer.profile.userProfileUuid)).toBeUndefined()
  })

  it('excludes Rejected members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const newPlayer = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, { status: 'Rejected' })

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.find((m) => m.userId === newPlayer.profile.userProfileUuid)).toBeUndefined()
  })

  it('excludes Removed members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const newPlayer = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, { status: 'Removed' })

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.find((m) => m.userId === newPlayer.profile.userProfileUuid)).toBeUndefined()
  })

  it('requires membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.campaigns.queries.getMembersByCampaign, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.query(api.campaigns.queries.getMembersByCampaign, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })
})

describe('getCampaignRequests', () => {
  const t = createTestContext()

  it('returns only non-Accepted members with profiles', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const pending = await setupUser(t)
    const rejected = await setupUser(t)
    const removed = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, pending.profile, { status: 'Pending' })
    await addPlayerToCampaign(t, ctx.campaignId, rejected.profile, { status: 'Rejected' })
    await addPlayerToCampaign(t, ctx.campaignId, removed.profile, { status: 'Removed' })

    const members = await dmAuth.query(api.campaigns.queries.getCampaignRequests, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members).toHaveLength(3)
    for (const member of members) {
      expect(member.userProfile).toBeDefined()
    }
    expect(members.find((m) => m.userId === pending.profile.userProfileUuid)?.status).toBe(
      'Pending',
    )
    expect(members.find((m) => m.userId === rejected.profile.userProfileUuid)?.status).toBe(
      'Rejected',
    )
    expect(members.find((m) => m.userId === removed.profile.userProfileUuid)?.status).toBe(
      'Removed',
    )
    expect(members.find((m) => m.userId === ctx.player.profile.userProfileUuid)).toBeUndefined()
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.query(api.campaigns.queries.getCampaignRequests, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('requires membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.campaigns.queries.getCampaignRequests, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.query(api.campaigns.queries.getCampaignRequests, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })
})

describe('joinCampaign', () => {
  const t = createTestContext()

  it('creates Pending membership', async () => {
    const dm = await setupUser(t)
    const { campaignId, slug } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)

    const status = await player.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug,
    })

    expect(status).toBe('Pending')

    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) =>
          q.eq('campaignId', campaignId).eq('userId', player.profile._id),
        )
        .unique()
      expect(member).not.toBeNull()
      expect(member!.role).toBe('Player')
      expect(member!.status).toBe('Pending')
      expect(isUuidV7(member!.campaignMemberUuid)).toBe(true)
    })
  })

  it('returns existing status if already member', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const status = await playerAuth.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: ctx.dm.profile.username,
      slug: ctx.slug,
    })

    expect(status).toBe('Accepted')
  })

  it('returns NOT_FOUND for deleted campaign', async () => {
    const dm = await setupUser(t)
    const { campaignId, slug } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)

    await t.run(async (ctx) => {
      await ctx.db.delete('campaigns', campaignId)
    })

    await expectNotFound(
      player.authed.mutation(api.campaigns.mutations.joinCampaign, {
        dmUsername: dm.profile.username,
        slug,
      }),
    )
  })

  it('returns existing Removed status without resetting', async () => {
    const dm = await setupUser(t)
    const { campaignId, slug } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Removed',
    })

    const status = await player.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug,
    })

    expect(status).toBe('Removed')

    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) =>
          q.eq('campaignId', campaignId).eq('userId', player.profile._id),
        )
        .unique()
      expect(member!.status).toBe('Removed')
    })
  })

  it('returns existing Rejected status without resetting', async () => {
    const dm = await setupUser(t)
    const { campaignId, slug } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Rejected',
    })

    const status = await player.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug,
    })

    expect(status).toBe('Rejected')

    await t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) =>
          q.eq('campaignId', campaignId).eq('userId', player.profile._id),
        )
        .unique()
      expect(member!.status).toBe('Rejected')
    })
  })

  it('requires authentication', async () => {
    const dm = await setupUser(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.joinCampaign, {
        dmUsername: dm.profile.username,
        slug: 'campaign',
      }),
    )
  })
})

describe('updateCampaignMemberStatus', () => {
  const t = createTestContext()

  it('transitions Pending to Accepted', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId, memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    const result = await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: memberDomainId,
      status: 'Accepted',
    })
    expect(result).toBe(memberDomainId)

    await t.run(async (ctx) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      expect(member!.status).toBe('Accepted')
    })
    expect(await acceptedMemberCount(t, campaignId)).toBe(2)
  })

  it('transitions Pending to Rejected', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId, memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: memberDomainId,
      status: 'Rejected',
    })

    await t.run(async (ctx) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      expect(member!.status).toBe('Rejected')
    })
    expect(await acceptedMemberCount(t, campaignId)).toBe(1)
  })

  it('transitions Accepted to Removed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: ctx.campaignDomainId,
      memberId: ctx.player.memberDomainId,
      status: 'Removed',
    })

    await t.run(async (dbCtx) => {
      const member = await dbCtx.db.get('campaignMembers', ctx.player.memberId)
      expect(member!.status).toBe('Removed')
    })
    expect(await acceptedMemberCount(t, ctx.campaignId)).toBe(1)
  })

  it('transitions Rejected to Accepted', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId, memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Rejected',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: memberDomainId,
      status: 'Accepted',
    })

    await t.run(async (ctx) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      expect(member!.status).toBe('Accepted')
    })
    expect(await acceptedMemberCount(t, campaignId)).toBe(2)
  })

  it('transitions Removed to Accepted', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId, memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Removed',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId: campaignDomainId,
      memberId: memberDomainId,
      status: 'Accepted',
    })

    const member = await t.run(async (ctx) => await ctx.db.get('campaignMembers', memberId))
    expect(member?.status).toBe('Accepted')
    expect(await acceptedMemberCount(t, campaignId)).toBe(2)
  })

  it('serializes concurrent accepted transitions through the campaign count', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const players = await Promise.all([setupUser(t), setupUser(t)])
    const members = await Promise.all(
      players.map((player) =>
        addPlayerToCampaign(t, campaignId, player.profile, { status: 'Pending' }),
      ),
    )

    await Promise.all(
      members.map((member) =>
        dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
          campaignId: campaignDomainId,
          memberId: member.memberDomainId,
          status: 'Accepted',
        }),
      ),
    )

    expect(await acceptedMemberCount(t, campaignId)).toBe(3)
  })

  it('rejects Accepted to Accepted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignDomainId,
        memberId: ctx.player.memberDomainId,
        status: 'Accepted',
      }),
    )
    expect(await acceptedMemberCount(t, ctx.campaignId)).toBe(2)
  })

  it('rejects Pending to Removed', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await expectValidationFailed(
      dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: campaignDomainId,
        memberId: memberDomainId,
        status: 'Removed',
      }),
    )
  })

  it('rejects non-DM caller', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const newPlayer = await setupUser(t)
    const { memberDomainId } = await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, {
      status: 'Pending',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignDomainId,
        memberId: memberDomainId,
        status: 'Accepted',
      }),
    )
  })

  it('rejects changing DM status', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectPermissionDenied(
      dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignDomainId,
        memberId: ctx.dm.memberDomainId,
        status: 'Removed',
      }),
    )
  })

  it('rejects deleted member', async () => {
    const dm = await setupUser(t)
    const { campaignId, campaignDomainId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId, memberDomainId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await t.run(async (ctx) => {
      await ctx.db.delete('campaignMembers', memberId)
    })

    await expectNotFound(
      dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: campaignDomainId,
        memberId: memberDomainId,
        status: 'Accepted',
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignDomainId,
        memberId: ctx.player.memberDomainId,
        status: 'Removed',
      }),
    )
  })
})

describe('updateCampaign', () => {
  const t = createTestContext()

  it('updates name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      name: 'Updated Name',
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign!.name).toBe('Updated Name')
    })
  })

  it('updates description', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      description: 'New description',
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign!.description).toBe('New description')
    })
  })

  it('updates the campaign link', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      slug: 'updated-campaign',
    })

    const campaign = await dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
      dmUsername: ctx.dm.profile.username,
      slug: 'updated-campaign',
    })
    expect(campaign.id).toBe(ctx.campaignDomainId)
    await expectNotFound(
      dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: ctx.dm.profile.username,
        slug: ctx.slug,
      }),
    )
  })

  it('rejects a campaign link already owned by the DM', async () => {
    const ctx = await setupCampaignContext(t)
    const other = await createCampaignWithDm(t, ctx.dm.profile)

    await expectConflict(
      asDm(ctx).mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        slug: other.slug,
      }),
    )
  })

  it('validates campaign links', async () => {
    const ctx = await setupCampaignContext(t)

    await expectValidationFailed(
      asDm(ctx).mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        slug: 'Invalid Link',
      }),
    )
  })

  it('validates name constraints', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        name: 'ab',
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        name: 'Hacked',
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        name: 'Nope',
      }),
    )
  })
})

describe('deleteCampaign', () => {
  const t = createTestContext(true)

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.campaigns.mutations.deleteCampaign, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('hard-deletes campaign and all related records', async () => {
    vi.useFakeTimers()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const resourceIds: Array<ResourceId> = []

    for (const kind of ['note', 'folder'] as const) {
      const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
      resourceIds.push(resourceId)
      await dmAuth.mutation(api.resources.mutations.executeStructureCommand, {
        campaignId: ctx.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId,
          kind,
          parentId: null,
          title: canonicalizeResourceTitle(kind),
          icon: null,
          color: null,
        },
      })
    }
    const historyResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    resourceIds.push(historyResourceId)
    await expect(
      dmAuth.mutation(api.resources.mutations.createCanvasResource, {
        campaignId: ctx.campaignDomainId,
        operationId: generateDomainId(DOMAIN_ID_KIND.operation),
        command: {
          type: 'create',
          resourceId: historyResourceId,
          kind: 'canvas',
          parentId: null,
          title: canonicalizeResourceTitle('History canvas'),
          icon: null,
          color: null,
        },
      }),
    ).resolves.toMatchObject({ status: 'completed' })
    const upload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['campaign deletion asset'], { type: 'text/plain' }),
      'campaign-deletion.bin',
    )
    const fileJobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    const fileReservation = await dmAuth.mutation(api.resources.mutations.reservePlainTransfer, {
      campaignId: ctx.campaignDomainId,
      jobId: fileJobId,
      destinationParentId: null,
      textFileHandling: 'files',
      sources: [{ id: 'selected-file', kind: 'file', name: 'campaign-deletion.bin' }],
      entries: [
        {
          sourceId: 'selected-file',
          path: 'campaign-deletion.bin',
          type: 'file',
          byteSize: 'campaign deletion asset'.length,
        },
      ],
    })
    if (fileReservation.status !== 'reserved' || !fileReservation.uploadTargets[0]) {
      throw new TypeError('Expected campaign deletion transfer reservation')
    }
    await t.run(async (dbCtx) => {
      const entry = await dbCtx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (query) =>
          query.eq('campaignUuid', ctx.campaignDomainId).eq('importJobUuid', fileJobId),
        )
        .filter((query) => query.eq(query.field('entryType'), 'file'))
        .unique()
      if (!entry) throw new TypeError('Expected campaign deletion transfer entry')
      await dbCtx.db.delete('fileStorage', fileReservation.uploadTargets[0]!.sessionId)
      await dbCtx.db.patch('resourceTransferEntries', entry._id, {
        uploadSessionUuid: upload.sessionId,
      })
    })
    const fileCreation = await dmAuth.action(api.resources.actions.commitPlainTransfer, {
      campaignId: ctx.campaignDomainId,
      jobId: fileJobId,
    })
    const fileEntry = fileCreation.status === 'settled' ? fileCreation.entries[0] : null
    if (!fileEntry || fileEntry.status !== 'completed') {
      throw new TypeError('Expected campaign deletion file fixture')
    }
    resourceIds.push(assertDomainId(DOMAIN_ID_KIND.resource, fileEntry.resourceId))
    const transferJobId = generateDomainId(DOMAIN_ID_KIND.importJob)
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('resourceTransferJobs', {
        campaignUuid: ctx.campaignDomainId,
        importJobUuid: transferJobId,
        actorMemberUuid: ctx.dm.memberDomainId,
        manifestVersion: 'plain-transfer-manifest-v1',
        fingerprint: 'pending-transfer',
        destinationParentUuid: null,
        textFileHandling: 'files',
        sources: [{ id: 'selected-file', kind: 'file', name: 'pending.txt' }],
        status: 'reserved',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await dbCtx.db.insert('resourceTransferEntries', {
        campaignUuid: ctx.campaignDomainId,
        importJobUuid: transferJobId,
        sourceRootId: 'selected-file',
        sourceEntryPath: 'pending.txt',
        rawPath: 'pending.txt',
        normalizedPath: 'pending.txt',
        plannedResourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
        plannedOperationUuid: generateDomainId(DOMAIN_ID_KIND.operation),
        parentResourceUuid: null,
        title: 'pending.txt',
        entryType: 'file',
        isExplicit: true,
        declaredByteSize: 0,
        uploadSessionUuid: null,
        resourceKind: 'file',
        resourceUuid: null,
        status: 'pending',
        rejectionReason: null,
      })
      await dbCtx.db.insert('resourceSourcePathAliases', {
        campaignUuid: ctx.campaignDomainId,
        resourceUuid: resourceIds[0]!,
        importJobUuid: transferJobId,
        sourceRootId: 'selected-file',
        rawPath: 'pending.txt',
        normalizedPath: 'pending.txt',
      })
      const content = await dbCtx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', historyResourceId))
        .unique()
      if (!content) throw new TypeError('Expected canvas content')
      await dbCtx.db.insert('itemHistoryCaptureIntents', {
        resourceUuid: historyResourceId,
        actorMemberUuid: ctx.dm.memberDomainId,
        version: content.version,
      })
      const snapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
      await dbCtx.db.insert('itemHistoryCheckpoints', {
        snapshotUuid: snapshotId,
        campaignUuid: ctx.campaignDomainId,
        resourceUuid: historyResourceId,
        kind: 'canvas',
        update: content.update,
        version: content.version,
      })
      await dbCtx.db.insert('itemHistoryEntries', {
        historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
        campaignUuid: ctx.campaignDomainId,
        resourceUuid: historyResourceId,
        actorMemberUuid: ctx.dm.memberDomainId,
        action: ITEM_HISTORY_ACTION.contentEdited,
        metadata: null,
        checkpoint: { kind: 'canvas', snapshotId, version: content.version },
        createdAt: Date.now(),
      })
      const restoreOperationId = generateDomainId(DOMAIN_ID_KIND.operation)
      const restoredHistoryEntryId = generateDomainId(DOMAIN_ID_KIND.historyEntry)
      const preservedSnapshotId = generateDomainId(DOMAIN_ID_KIND.snapshot)
      await dbCtx.db.insert('itemHistoryRestoreOperations', {
        campaignUuid: ctx.campaignDomainId,
        actorMemberUuid: ctx.dm.memberDomainId,
        resourceUuid: historyResourceId,
        operationUuid: restoreOperationId,
        protocolVersion: ITEM_HISTORY_RESTORE_PROTOCOL_VERSION,
        fingerprint: '0'.repeat(64),
        receipt: {
          status: 'restored',
          operationId: restoreOperationId,
          historyEntryId: restoredHistoryEntryId,
          preservedSnapshotId,
          restoredFromEntryId: restoredHistoryEntryId,
        },
      })
      await dbCtx.db.insert('yjsRecoveryReapplyOperations', {
        campaignUuid: ctx.campaignDomainId,
        actorMemberUuid: ctx.dm.memberDomainId,
        resourceUuid: historyResourceId,
        operationUuid: generateDomainId(DOMAIN_ID_KIND.operation),
        protocolVersion: YJS_RECOVERY_REAPPLY_PROTOCOL_VERSION,
        fingerprint: '0'.repeat(64),
      })
      for (let index = 0; index < 40; index += 1) {
        await dbCtx.db.insert('itemHistoryEntries', {
          historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
          campaignUuid: ctx.campaignDomainId,
          resourceUuid: historyResourceId,
          actorMemberUuid: ctx.dm.memberDomainId,
          action: ITEM_HISTORY_ACTION.renamed,
          metadata: { from: `Before ${index}`, to: `After ${index}` },
          createdAt: Date.now() + index + 1,
        })
      }
    })
    await createSession(t, ctx.campaignId)
    await Promise.all(
      Array.from({ length: 13 }, (_, batch) =>
        t.run(async (dbCtx) => {
          await Promise.all(
            Array.from({ length: 10 }, (_, index) => {
              return dbCtx.db.insert('resourceCanvasContents', {
                campaignUuid: ctx.campaignDomainId,
                resourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
                update: new ArrayBuffer(140_000 + batch * 10 + index),
                version: {
                  scheme: 'authoritative-revision-v1',
                  revision: 1,
                  digest: '0'.repeat(64),
                },
              })
            }),
          )
        }),
      ),
    )

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign?.status).toBe('Deleted')
      expect(campaign?.acceptedMemberCount).toBe(0)
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign).toBeNull()

      const members = await dbCtx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', ctx.campaignId))
        .collect()
      expect(members).toHaveLength(0)

      const resources = await dbCtx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(resources).toHaveLength(0)

      const operations = await dbCtx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_actor', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(operations).toHaveLength(0)

      const canvasContents = await dbCtx.db
        .query('resourceCanvasContents')
        .withIndex('by_campaignUuid', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(canvasContents).toHaveLength(0)

      const searchDocuments = await dbCtx.db
        .query('resourceSearchDocuments')
        .withIndex('by_campaign_and_resource', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(searchDocuments).toHaveLength(0)

      const historyEntries = await dbCtx.db
        .query('itemHistoryEntries')
        .withIndex('by_resource_history', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(historyEntries).toHaveLength(0)

      const historyRestoreOperations = await dbCtx.db
        .query('itemHistoryRestoreOperations')
        .withIndex('by_campaign_and_actor', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(historyRestoreOperations).toHaveLength(0)

      const recoveryReapplyOperations = await dbCtx.db
        .query('yjsRecoveryReapplyOperations')
        .withIndex('by_campaign_and_actor', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(recoveryReapplyOperations).toHaveLength(0)

      const historyCheckpoints = await dbCtx.db
        .query('itemHistoryCheckpoints')
        .withIndex('by_resource_snapshot', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(historyCheckpoints).toHaveLength(0)

      const historyCaptureIntent = await dbCtx.db
        .query('itemHistoryCaptureIntents')
        .withIndex('by_resourceUuid', (q) => q.eq('resourceUuid', historyResourceId))
        .unique()
      expect(historyCaptureIntent).toBeNull()

      const transferJobs = await dbCtx.db
        .query('resourceTransferJobs')
        .withIndex('by_campaign_and_importJobUuid', (q) =>
          q.eq('campaignUuid', ctx.campaignDomainId),
        )
        .collect()
      expect(transferJobs).toHaveLength(0)

      const transferEntries = await dbCtx.db
        .query('resourceTransferEntries')
        .withIndex('by_campaign_and_job', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(transferEntries).toHaveLength(0)

      const sourceAliases = await dbCtx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (q) => q.eq('campaignUuid', ctx.campaignDomainId))
        .collect()
      expect(sourceAliases).toHaveLength(0)

      const assetOwners = await dbCtx.db
        .query('resourceAssetOwners')
        .withIndex('by_assetUuid', (q) => q.eq('assetUuid', upload.assetId))
        .collect()
      expect(assetOwners).toHaveLength(0)

      const retirementCandidate = await dbCtx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (q) => q.eq('assetUuid', upload.assetId))
        .unique()
      expect(retirementCandidate).toBeNull()
      await expect(dbCtx.db.get('fileStorage', upload.sessionId)).resolves.toBeNull()
      await expect(dbCtx.storage.get(upload.storageId)).resolves.toBeNull()

      const sessions = await dbCtx.db
        .query('sessions')
        .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', ctx.campaignId))
        .collect()
      expect(sessions).toHaveLength(0)
    })
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.deleteCampaign, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })
})
