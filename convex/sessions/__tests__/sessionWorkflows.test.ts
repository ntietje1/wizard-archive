import { describe, expect, it } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { expectConflict, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('session workflows', () => {
  const t = createTestContext()

  describe('session lifecycle', () => {
    it('starting a new session auto-ends the previous one', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const s1Id = await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
        name: 'Session 1',
      })

      const s2Id = await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
        name: 'Session 2',
      })

      const s1 = await t.run(async (dbCtx) =>
        dbCtx.db
          .query('sessions')
          .withIndex('by_sessionUuid', (query) => query.eq('sessionUuid', s1Id))
          .unique(),
      )
      expect(s1).not.toBeNull()
      expect(s1!.endedAt).not.toBeNull()

      const s2 = await t.run(async (dbCtx) =>
        dbCtx.db
          .query('sessions')
          .withIndex('by_sessionUuid', (query) => query.eq('sessionUuid', s2Id))
          .unique(),
      )
      expect(s2).not.toBeNull()
      expect(s2!.endedAt).toBeNull()
    })

    it('end then resume a session', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const s1Id = await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
        name: 'Session 1',
      })

      const s2Id = await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
        name: 'Session 2',
      })

      await dmAuth.mutation(api.sessions.mutations.endCurrentSession, {
        campaignId: ctx.campaignDomainId,
      })

      const s2Ended = await t.run(async (dbCtx) =>
        dbCtx.db
          .query('sessions')
          .withIndex('by_sessionUuid', (query) => query.eq('sessionUuid', s2Id))
          .unique(),
      )
      expect(s2Ended!.endedAt).not.toBeNull()

      await dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
        campaignId: ctx.campaignDomainId,
        sessionId: s2Id,
      })

      const s2Resumed = await t.run(async (dbCtx) =>
        dbCtx.db
          .query('sessions')
          .withIndex('by_sessionUuid', (query) => query.eq('sessionUuid', s2Id))
          .unique(),
      )
      expect(s2Resumed!.endedAt).toBeNull()

      await expectConflict(
        dmAuth.mutation(api.sessions.mutations.setCurrentSession, {
          campaignId: ctx.campaignDomainId,
          sessionId: s1Id,
        }),
      )
    })
  })

  describe('player restrictions', () => {
    it('players cannot start, end, or resume sessions', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)

      await expectPermissionDenied(
        playerAuth.mutation(api.sessions.mutations.startSession, {
          campaignId: ctx.campaignDomainId,
        }),
      )

      const sessionId = await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
      })

      await expectPermissionDenied(
        playerAuth.mutation(api.sessions.mutations.endCurrentSession, {
          campaignId: ctx.campaignDomainId,
        }),
      )

      await expectPermissionDenied(
        playerAuth.mutation(api.sessions.mutations.setCurrentSession, {
          campaignId: ctx.campaignDomainId,
          sessionId,
        }),
      )
    })

    it('players can query sessions', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)

      await dmAuth.mutation(api.sessions.mutations.startSession, {
        campaignId: ctx.campaignDomainId,
        name: 'Visible Session',
      })

      const current = await playerAuth.query(api.sessions.queries.getCurrentSession, {
        campaignId: ctx.campaignDomainId,
      })
      expect(current).not.toBeNull()
      expect(current!.name).toBe('Visible Session')

      const allSessions = await playerAuth.query(api.sessions.queries.getSessionsByCampaign, {
        campaignId: ctx.campaignDomainId,
      })
      expect(allSessions.length).toBeGreaterThanOrEqual(1)
    })
  })
})
