import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { api } from '../../_generated/api'

describe('session + editor state interaction', () => {
  const t = createTestContext()

  it('starting a session sets campaign.currentSessionId, ending clears it', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    const campaignAfterStart = await t.run(async (dbCtx) => dbCtx.db.get("campaigns", ctx.campaignId))
    expect(campaignAfterStart!.currentSessionId).toBe(sessionId)

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })

    const campaignAfterEnd = await t.run(async (dbCtx) => dbCtx.db.get("campaigns", ctx.campaignId))
    expect(campaignAfterEnd!.currentSessionId).toBeNull()

    const session = await t.run(async (dbCtx) => dbCtx.db.get("sessions", sessionId))
    expect(session!.endedAt).not.toBeNull()
  })

  it('editor state persists across sessions and is per-user', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: 'Alphabetical',
      sortDirection: 'Ascending',
    })

    await playerAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: 'DateCreated',
      sortDirection: 'Descending',
    })

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })
    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })
    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    const dmEditor = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(dmEditor!.sortOrder).toBe('Alphabetical')
    expect(dmEditor!.sortDirection).toBe('Ascending')

    const playerEditor = await playerAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(playerEditor!.sortOrder).toBe('DateCreated')
    expect(playerEditor!.sortDirection).toBe('Descending')
  })

  it('starting a new session auto-ends the previous one', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const s1 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })
    const s2 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })
    const s3 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    const [session1, session2, session3] = await t.run(async (dbCtx) => [
      await dbCtx.db.get("sessions", s1),
      await dbCtx.db.get("sessions", s2),
      await dbCtx.db.get("sessions", s3),
    ])

    expect(session1!.endedAt).not.toBeNull()
    expect(session2!.endedAt).not.toBeNull()
    expect(session3!.endedAt).toBeNull()

    const campaign = await t.run(async (dbCtx) => dbCtx.db.get("campaigns", ctx.campaignId))
    expect(campaign!.currentSessionId).toBe(s3)
  })

  it('campaign deletion also deletes all sessions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const s1 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Session 1',
    })
    const s2 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Session 2',
    })
    const s3 = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Session 3',
    })

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignId,
    })

    const [r1, r2, r3] = await t.run(async (dbCtx) => [
      await dbCtx.db.get("sessions", s1),
      await dbCtx.db.get("sessions", s2),
      await dbCtx.db.get("sessions", s3),
    ])
    expect(r1).toBeNull()
    expect(r2).toBeNull()
    expect(r3).toBeNull()
  })
})
