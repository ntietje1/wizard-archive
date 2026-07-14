import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  addPlayerToCampaign,
  createCampaignWithDm,
  createFolder,
  getCampaignRowId,
  createNote,
  createSession,
} from '../../_test/factories.helper'
import {
  expectConflict,
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'

describe('createCampaign', () => {
  const t = createTestContext()

  it('creates a campaign and DM membership', async () => {
    const { authed, profile } = await setupUser(t)

    const campaignId = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'My Campaign',
      slug: 'my-campaign',
    })

    expect(campaignId).toBeDefined()
    const campaignRowId = await getCampaignRowId(t, campaignId)

    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignRowId)
      expect(campaign).not.toBeNull()
      expect(campaign!.name).toBe('My Campaign')
      expect(campaign!.slug).toBe('my-campaign')
      expect(campaign!.dmUserId).toBe(profile._id)
      expect(campaign!.status).toBe('Active')
      expect(isUuidV7(campaign!.campaignUuid)).toBe(true)

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
  })

  it('validates name minimum length', async () => {
    const { authed } = await setupUser(t)
    await expectValidationFailed(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'ab',
        slug: 'valid-slug',
      }),
    )
  })

  it('validates name maximum length', async () => {
    const { authed } = await setupUser(t)
    await expectValidationFailed(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'a'.repeat(31),
        slug: 'valid-slug',
      }),
    )
  })

  it('accepts name at exactly 3 characters', async () => {
    const { authed } = await setupUser(t)
    const id = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'abc',
      slug: 'abc-slug',
    })
    expect(id).toBeDefined()
  })

  it('accepts name at exactly 30 characters', async () => {
    const { authed } = await setupUser(t)
    const id = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'a'.repeat(30),
      slug: 'thirty-char',
    })
    expect(id).toBeDefined()
  })

  it('validates slug format', async () => {
    const { authed } = await setupUser(t)
    await expectValidationFailed(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'Valid Name',
        slug: 'invalid slug!',
      }),
    )
  })

  it('rejects duplicate slug for same DM', async () => {
    const { authed } = await setupUser(t)
    await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'First Campaign',
      slug: 'duplicate',
    })
    await expectConflict(
      authed.mutation(api.campaigns.mutations.createCampaign, {
        name: 'Second Campaign',
        slug: 'duplicate',
      }),
    )
  })

  it('allows same slug for different DMs', async () => {
    const dm1 = await setupUser(t)
    const dm2 = await setupUser(t)

    const id1 = await dm1.authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'Campaign One',
      slug: 'same-slug',
    })
    const id2 = await dm2.authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'Campaign Two',
      slug: 'same-slug',
    })

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.createCampaign, {
        name: 'Test',
        slug: 'test',
      }),
    )
  })
})

describe('getUserCampaigns', () => {
  const t = createTestContext()

  it('returns only Accepted membership campaigns', async () => {
    const user = await setupUser(t)

    const { campaignDomainId } = await createCampaignWithDm(t, user.profile)

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})

    expect(campaigns).toHaveLength(1)
    expect(campaigns[0].id).toBe(campaignDomainId)
  })

  it('excludes Pending memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Pending',
    })

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns).toHaveLength(0)
  })

  it('excludes Rejected memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Rejected',
    })

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns).toHaveLength(0)
  })

  it('excludes Removed memberships', async () => {
    const user = await setupUser(t)
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, user.profile, {
      status: 'Removed',
    })

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns).toHaveLength(0)
  })

  it('excludes deleted campaigns', async () => {
    const user = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, user.profile)
    await t.run(async (ctx) => {
      await ctx.db.delete('campaigns', campaignId)
    })

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns).toHaveLength(0)
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const campaigns = await dmAuth.query(api.campaigns.queries.getUserCampaigns, {})

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

    const campaigns = await playerAuth.query(api.campaigns.queries.getUserCampaigns, {})

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

    let campaigns = await dm.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns.find((campaign) => campaign.id === campaignDomainId)).toMatchObject({
      acceptedMemberCount: 1,
    })

    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile)

    campaigns = await dm.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns.find((campaign) => campaign.id === campaignDomainId)).toMatchObject({
      acceptedMemberCount: 2,
    })
  })

  it('requires authentication', async () => {
    await expectNotAuthenticated(t.query(api.campaigns.queries.getUserCampaigns, {}))
  })
})

describe('getCampaignBySlug', () => {
  const t = createTestContext()

  it('returns campaign by dmUsername and slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    let slug = ''
    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      slug = campaign!.slug
    })

    const campaign = await dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
      dmUsername: ctx.dm.profile.username,
      slug,
    })

    expect(campaign.id).toBe(ctx.campaignDomainId)
    expect(campaign.dmUserProfile).toBeDefined()
  })

  it('returns public DM and membership profiles without private account fields', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    let slug = ''
    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      slug = campaign!.slug
    })

    const campaign = await playerAuth.query(api.campaigns.queries.getCampaignBySlug, {
      dmUsername: ctx.dm.profile.username,
      slug,
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

  it('returns NOT_FOUND for nonexistent slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectNotFound(
      dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: ctx.dm.profile.username,
        slug: 'nonexistent',
      }),
    )
  })

  it('returns NOT_FOUND for deleted campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    let slug = ''
    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      slug = campaign!.slug
      await dbCtx.db.delete('campaigns', ctx.campaignId)
    })

    await expectNotFound(
      dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: ctx.dm.profile.username,
        slug,
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

    expect(members.find((m) => m.userId === newPlayer.profile._id)).toBeUndefined()
  })

  it('excludes Rejected members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const newPlayer = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, { status: 'Rejected' })

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.find((m) => m.userId === newPlayer.profile._id)).toBeUndefined()
  })

  it('excludes Removed members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const newPlayer = await setupUser(t)
    await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, { status: 'Removed' })

    const members = await dmAuth.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(members.find((m) => m.userId === newPlayer.profile._id)).toBeUndefined()
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
    expect(members.find((m) => m.userId === pending.profile._id)?.status).toBe('Pending')
    expect(members.find((m) => m.userId === rejected.profile._id)?.status).toBe('Rejected')
    expect(members.find((m) => m.userId === removed.profile._id)?.status).toBe('Removed')
    expect(members.find((m) => m.userId === ctx.player.profile._id)).toBeUndefined()
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
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)

    let slug = ''
    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      slug = campaign!.slug
    })

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

    let slug = ''
    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      slug = campaign!.slug
    })

    const status = await playerAuth.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: ctx.dm.profile.username,
      slug,
    })

    expect(status).toBe('Accepted')
  })

  it('returns NOT_FOUND for deleted campaign', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)

    let slug = ''
    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      slug = campaign!.slug
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
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Removed',
    })

    let slug = ''
    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      slug = campaign!.slug
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
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Rejected',
    })

    let slug = ''
    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      slug = campaign!.slug
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
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.joinCampaign, {
        dmUsername: 'someone',
        slug: 'something',
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

  it('normalizes nullable folder inheritance defaults for existing campaigns', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('campaigns', ctx.campaignId, { defaultFolderInheritShares: null })
    })

    const campaigns = await dmAuth.query(api.campaigns.queries.getUserCampaigns, {})
    expect(campaigns.find((campaign) => campaign.id === ctx.campaignDomainId)).toMatchObject({
      defaultFolderInheritShares: false,
    })

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const folder = await t.run(async (dbCtx) =>
      dbCtx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
        .unique(),
    )
    expect(folder?.inheritShares).toBe(false)
  })

  it('updates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignDomainId,
      slug: 'new-slug',
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign!.slug).toBe('new-slug')
    })
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

  it('validates slug constraints', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignDomainId,
        slug: 'invalid slug',
      }),
    )
  })

  it('rejects slug conflict for same DM', async () => {
    const dm = await setupUser(t)
    await createCampaignWithDm(t, dm.profile, {
      slug: 'taken-slug',
    })
    const { campaignDomainId: c2 } = await createCampaignWithDm(t, dm.profile, {
      slug: 'other-slug',
    })

    await expectConflict(
      dm.authed.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: c2,
        slug: 'taken-slug',
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
  const t = createTestContext()

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
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    await createSession(t, ctx.campaignId)

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign).toBeNull()

      const members = await dbCtx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', ctx.campaignId))
        .collect()
      expect(members).toHaveLength(0)

      const sidebarItems = await dbCtx.db
        .query('sidebarItems')
        .withIndex('by_campaign_deletionTime', (q) => q.eq('campaignId', ctx.campaignId))
        .collect()
      expect(sidebarItems).toHaveLength(0)

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
