import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import { expectNotAuthenticated, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { EDITOR_MODE, SORT_DIRECTIONS, SORT_ORDERS } from '../types'

describe('getCurrentEditor', () => {
  const t = createTestContext()

  it('returns null when no editor set for new user', async () => {
    const ctx = await setupCampaignContext(t)
    const result = await asDm(ctx).query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).toBeNull()
  })

  it('returns null when no editor set', async () => {
    const ctx = await setupCampaignContext(t)
    const result = await asDm(ctx).query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).toBeNull()
  })

  it('returns editor after setting one', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: EDITOR_MODE.VIEWER,
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).not.toBeNull()
    expect(result!.sortOrder).toBe(SORT_ORDERS.Alphabetical)
    expect(result!.sortDirection).toBe(SORT_DIRECTIONS.Descending)
    expect(result!.editorMode).toBe(EDITOR_MODE.VIEWER)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.query(api.editors.queries.getCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)
    await expectPermissionDenied(
      outsider.authed.query(api.editors.queries.getCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})

describe('setCurrentEditor', () => {
  const t = createTestContext()

  it('creates editor with defaults', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const id = await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(id).toBeDefined()

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).not.toBeNull()
    expect(result!.sortOrder).toBe(SORT_ORDERS.DateCreated)
    expect(result!.sortDirection).toBe(SORT_DIRECTIONS.Ascending)
    expect(result!.editorMode).toBe(EDITOR_MODE.EDITOR)
  })

  it('upserts existing editor', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const id1 = await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: SORT_ORDERS.Alphabetical,
    })

    const id2 = await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: SORT_ORDERS.DateModified,
    })

    expect(id1).toBe(id2)

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result!.sortOrder).toBe(SORT_ORDERS.DateModified)
  })

  it('partial update only changes provided fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: EDITOR_MODE.VIEWER,
    })

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      editorMode: EDITOR_MODE.EDITOR,
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result!.sortOrder).toBe(SORT_ORDERS.Alphabetical)
    expect(result!.sortDirection).toBe(SORT_DIRECTIONS.Descending)
    expect(result!.editorMode).toBe(EDITOR_MODE.EDITOR)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    await expectNotAuthenticated(
      t.mutation(api.editors.mutations.setCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('requires campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)
    await expectPermissionDenied(
      outsider.authed.mutation(api.editors.mutations.setCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
  })

  it('returns editor shape with expected fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).toMatchObject({
      _id: expect.any(String),
      _creationTime: expect.any(Number),
      userId: expect.any(String),
      campaignId: ctx.campaignId,
      sortOrder: expect.any(String),
      sortDirection: expect.any(String),
      editorMode: expect.any(String),
    })
  })

  it('players can set their own editor', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const id = await playerAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(id).toBeDefined()
  })

  it('returns null after editor record is hard-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const id = await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('editor', id)
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).toBeNull()
  })
})
