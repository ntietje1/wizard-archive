import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  addPlayerToCampaign,
  createCampaignWithDm,
  createFolder,
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

describe('createCampaign', () => {
  const t = createTestContext()

  it('creates a campaign and DM membership', async () => {
    const { authed, profile } = await setupUser(t)

    const campaignId = await authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'My Campaign',
      slug: 'my-campaign',
    })

    expect(campaignId).toBeDefined()

    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      expect(campaign).not.toBeNull()
      expect(campaign!.name).toBe('My Campaign')
      expect(campaign!.slug).toBe('my-campaign')
      expect(campaign!.dmUserId).toBe(profile._id)
      expect(campaign!.status).toBe('Active')

      const members = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
        .collect()
      expect(members).toHaveLength(1)
      expect(members[0].role).toBe('DM')
      expect(members[0].status).toBe('Accepted')
      expect(members[0].userId).toBe(profile._id)
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

    const { campaignId } = await createCampaignWithDm(t, user.profile)

    const campaigns = await user.authed.query(api.campaigns.queries.getUserCampaigns, {})

    expect(campaigns).toHaveLength(1)
    expect(campaigns[0]._id).toBe(campaignId)
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

  it('excludes soft-deleted campaigns', async () => {
    const user = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, user.profile)
    await t.run(async (ctx) => {
      await ctx.db.patch('campaigns', campaignId, {
        deletionTime: Date.now(),
        deletedBy: user.profile._id,
      })
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
    expect(campaign.dmUserProfile._id).toBe(ctx.dm.profile._id)
    expect(typeof campaign.playerCount).toBe('number')
    expect(campaign.myMembership).toBeDefined()
    expect(campaign.myMembership!._id).toBe(ctx.dm.memberId)
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

    expect(campaign._id).toBe(ctx.campaignId)
    expect(campaign.dmUserProfile).toBeDefined()
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

  it('returns NOT_FOUND for soft-deleted campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    let slug = ''
    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      slug = campaign!.slug
      await dbCtx.db.patch('campaigns', ctx.campaignId, {
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await expectNotFound(
      dmAuth.query(api.campaigns.queries.getCampaignBySlug, {
        dmUsername: ctx.dm.profile.username,
        slug,
      }),
    )
  })
})

describe('getPlayersByCampaign', () => {
  const t = createTestContext()

  it('returns all members with profiles', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const members = await dmAuth.query(api.campaigns.queries.getPlayersByCampaign, {
      campaignId: ctx.campaignId,
    })

    expect(members.length).toBeGreaterThanOrEqual(2)
    for (const member of members) {
      expect(member.userProfile).toBeDefined()
      expect(member.userProfile.username).toBeDefined()
    }
  })

  it('excludes soft-deleted members', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('campaignMembers', ctx.player.memberId, {
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    const members = await dmAuth.query(api.campaigns.queries.getPlayersByCampaign, {
      campaignId: ctx.campaignId,
    })

    const playerMember = members.find((m) => m._id === ctx.player.memberId)
    expect(playerMember).toBeUndefined()
  })

  it('requires membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.campaigns.queries.getPlayersByCampaign, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.query(api.campaigns.queries.getPlayersByCampaign, {
        campaignId: ctx.campaignId,
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

  it('returns NOT_FOUND for soft-deleted campaign', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)

    let slug = ''
    await t.run(async (ctx) => {
      const campaign = await ctx.db.get('campaigns', campaignId)
      slug = campaign!.slug
      await ctx.db.patch('campaigns', campaignId, {
        deletionTime: Date.now(),
        deletedBy: dm.profile._id,
      })
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
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    const result = await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId,
      status: 'Accepted',
    })
    expect(result).toBe(memberId)

    await t.run(async (ctx) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      expect(member!.status).toBe('Accepted')
    })
  })

  it('transitions Pending to Rejected', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId,
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
      campaignId: ctx.campaignId,
      memberId: ctx.player.memberId,
      status: 'Removed',
    })

    await t.run(async (dbCtx) => {
      const member = await dbCtx.db.get('campaignMembers', ctx.player.memberId)
      expect(member!.status).toBe('Removed')
    })
  })

  it('transitions Rejected to Accepted', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Rejected',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId,
      status: 'Accepted',
    })

    await t.run(async (ctx) => {
      const member = await ctx.db.get('campaignMembers', memberId)
      expect(member!.status).toBe('Accepted')
    })
  })

  it('rejects Removed to any status', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Removed',
    })

    await expectValidationFailed(
      dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId,
        memberId,
        status: 'Accepted',
      }),
    )
  })

  it('rejects Accepted to Accepted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignId,
        memberId: ctx.player.memberId,
        status: 'Accepted',
      }),
    )
  })

  it('rejects Pending to Removed', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await expectValidationFailed(
      dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId,
        memberId,
        status: 'Removed',
      }),
    )
  })

  it('rejects non-DM caller', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const newPlayer = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, ctx.campaignId, newPlayer.profile, {
      status: 'Pending',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignId,
        memberId,
        status: 'Accepted',
      }),
    )
  })

  it('rejects changing DM status', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectPermissionDenied(
      dmAuth.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignId,
        memberId: ctx.dm.memberId,
        status: 'Removed',
      }),
    )
  })

  it('rejects soft-deleted member', async () => {
    const dm = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const player = await setupUser(t)
    const { memberId } = await addPlayerToCampaign(t, campaignId, player.profile, {
      status: 'Pending',
    })

    await t.run(async (ctx) => {
      await ctx.db.patch('campaignMembers', memberId, {
        deletionTime: Date.now(),
        deletedBy: dm.profile._id,
      })
    })

    await expectNotFound(
      dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId,
        memberId,
        status: 'Accepted',
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
        campaignId: ctx.campaignId,
        memberId: ctx.player.memberId,
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
      campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      description: 'New description',
    })

    await t.run(async (dbCtx) => {
      const campaign = await dbCtx.db.get('campaigns', ctx.campaignId)
      expect(campaign!.description).toBe('New description')
    })
  })

  it('updates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
      campaignId: ctx.campaignId,
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
        campaignId: ctx.campaignId,
        name: 'ab',
      }),
    )
  })

  it('validates slug constraints', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignId,
        slug: 'a',
      }),
    )
  })

  it('rejects slug conflict for same DM', async () => {
    const dm = await setupUser(t)
    await createCampaignWithDm(t, dm.profile, {
      slug: 'taken-slug',
    })
    const { campaignId: c2 } = await createCampaignWithDm(t, dm.profile, {
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
        campaignId: ctx.campaignId,
        name: 'Hacked',
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.campaigns.mutations.updateCampaign, {
        campaignId: ctx.campaignId,
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
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('hard-deletes campaign and all related records', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    await createSession(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignId,
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
        .withIndex('by_campaign_location_parent_name', (q) => q.eq('campaignId', ctx.campaignId))
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
        campaignId: ctx.campaignId,
      }),
    )
  })
})
