import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  expectConflict,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import type { SessionId } from '@wizard-archive/editor/resources/domain-id'

describe('startSession', () => {
  const t = createTestContext()

  it('creates a session and sets currentSessionId on campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    expect(sessionId).toBeDefined()

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(current).not.toBeNull()
    expect(current!.id).toBe(sessionId)
    expect(isUuidV7(current!.id)).toBe(true)
  })

  it('auto-ends previous session when starting new one', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const firstId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
      name: 'Session 1',
    })

    const secondId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
      name: 'Session 2',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    const first = sessions.find((s) => s.id === firstId)
    const second = sessions.find((s) => s.id === secondId)

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.endedAt).not.toBeNull()
    expect(second!.endedAt).toBeNull()

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(current!.id).toBe(secondId)
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
    })

    const endedId = await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })

    expect(endedId).toBe(sessionId)

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(current).toBeNull()
  })

  it('throws NOT_FOUND if no active session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectNotFound(
      dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.endCurrentSession, {
        campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })

    const resumedId = await dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
      campaignId: ctx.campaignDomainId,
      sessionId,
    })

    expect(resumedId).toBe(sessionId)

    const current = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(current).not.toBeNull()
    expect(current!.id).toBe(sessionId)
    expect(current!.endedAt).toBeNull()
  })

  it('throws CONFLICT if another session is active', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const firstId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await expectConflict(
      dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
        campaignId: ctx.campaignDomainId,
        sessionId: firstId,
      }),
    )
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.setCurrentSession, {
        campaignId: ctx.campaignDomainId,
        sessionId,
      }),
    )
  })

  it('rejects provider-shaped session IDs', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
        campaignId: ctx.campaignDomainId,
        sessionId: 'session-row-id' as SessionId,
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
      campaignId: ctx.campaignDomainId,
      name: 'Original',
    })

    await dmAuth.mutation(api.sessions.mutations.updateSession, {
      campaignId: ctx.campaignDomainId,
      sessionId,
      name: 'Updated',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignDomainId,
    })
    const updated = sessions.find((s) => s.id === sessionId)
    expect(updated).toBeDefined()
    expect(updated!.name).toBe('Updated')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sessions.mutations.updateSession, {
        campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
    })

    const result = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(result).not.toBeNull()
  })

  it('returns null when no active session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.sessions.queries.getCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })
    expect(result).toBeNull()
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.sessions.queries.getCurrentSession, {
        campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
      name: 'S1',
    })
    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
      name: 'S2',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignDomainId,
    })
    expect(sessions.length).toBe(2)
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectPermissionDenied(
      outsider.authed.query(api.sessions.queries.getSessionsByCampaign, {
        campaignId: ctx.campaignDomainId,
      }),
    )
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
      name: 'Test',
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions[0]).toHaveProperty('id')
    expect(sessions[0]).toHaveProperty('campaignId')
    expect(sessions[0]).toHaveProperty('name')
    expect(sessions[0]).toHaveProperty('startedAt')
    expect(sessions[0]).toHaveProperty('endedAt')
  })

  it('ended sessions still appear in list', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.sessions.mutations.startSession, {
      campaignId: ctx.campaignDomainId,
    })

    await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
      campaignId: ctx.campaignDomainId,
    })

    const sessions = await dmAuth.query(api.sessions.queries.getSessionsByCampaign, {
      campaignId: ctx.campaignDomainId,
    })
    expect(sessions.length).toBe(1)
  })
})
