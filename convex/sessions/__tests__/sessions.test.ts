import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  expectConflict,
  expectNotFound,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('startSession', () => {
  const t = createTestContext()

  it('creates a session and sets currentSessionId on campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    expect(sessionId).toBeDefined()

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(current).not.toBeNull()
    expect(current!._id).toBe(sessionId)
  })

  it('auto-ends previous session when starting new one', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const firstId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Session 1',
    })

    const secondId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Session 2',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignId,
    })

    const first = sessions.find((s) => s._id === firstId)
    const second = sessions.find((s) => s._id === secondId)

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.endedAt).not.toBeNull()
    expect(second!.endedAt).toBeNull()

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(current!._id).toBe(secondId)
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})

describe('endCurrentSession', () => {
  const t = createTestContext()

  it('ends session and clears currentSessionId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    const endedId = await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })

    expect(endedId).toBe(sessionId)

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(current).toBeNull()
  })

  it('throws NOT_FOUND if no active session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectNotFound(
      dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.endCurrentSession, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})

describe('setCurrentSession', () => {
  const t = createTestContext()

  it('resumes an ended session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })

    const resumedId = await dmAuth.mutation(api.sessions.mutations.setCurrentSession, { sessionId })

    expect(resumedId).toBe(sessionId)

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(current).not.toBeNull()
    expect(current!._id).toBe(sessionId)
    expect(current!.endedAt).toBeNull()
  })

  it('throws CONFLICT if another session is active', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const firstId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await expectConflict(
      dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
        sessionId: firstId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.setCurrentSession, {
        sessionId,
      }),
    )
  })
})

describe('updateSession', () => {
  const t = createTestContext()

  it('updates session name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Original',
    })

    await dmAuth.mutation(api.sessions.mutations.updateSession, {
      sessionId,
      name: 'Updated',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignId,
    })
    const updated = sessions.find((s) => s._id === sessionId)
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('Updated')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.updateSession, {
        sessionId,
        name: 'Hacked',
      }),
    )
  })
})

describe('getCurrentSession', () => {
  const t = createTestContext()

  it('returns current session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    const result = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(result).not.toBeNull()
  })

  it('returns null when no active session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignId,
    })
    expect(result).toBeNull()
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.sessions.queries.getCurrentSession, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})

describe('getSessionsByCampaign', () => {
  const t = createTestContext()

  it('returns all sessions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'S1',
    })
    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'S2',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignId,
    })
    expect(sessions.length).toBe(2)
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.sessions.queries.getSessionsByCampaign, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
      name: 'Test',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignId,
    })

    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions[0]).toHaveProperty('_id')
    expect(sessions[0]).toHaveProperty('campaignId')
    expect(sessions[0]).toHaveProperty('name')
    expect(sessions[0]).toHaveProperty('startedAt')
    expect(sessions[0]).toHaveProperty('endedAt')
  })

  it('excludes soft-deleted sessions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignId,
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch("sessions", sessionId, {
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignId,
    })
    expect(sessions.length).toBe(0)
  })
})
