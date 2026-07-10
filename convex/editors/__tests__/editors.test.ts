import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import { api } from '../../_generated/api'
import {
  DEFAULT_SORT_OPTIONS,
  SORT_DIRECTIONS,
  SORT_ORDERS,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { WORKSPACE_MODE } from '../../../shared/workspace/workspace-mode'
import { expectNotAuthenticated, expectPermissionDenied } from '../../_test/assertions.helper'

describe('getCurrentEditor', () => {
  const t = createTestContext()

  it('returns editor after setting one', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: WORKSPACE_MODE.VIEWER,
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result).toMatchObject({
      sortOrder: SORT_ORDERS.Alphabetical,
      sortDirection: SORT_DIRECTIONS.Descending,
      editorMode: WORKSPACE_MODE.VIEWER,
    })
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
    expect(result).toMatchObject({
      sortOrder: DEFAULT_SORT_OPTIONS.order,
      sortDirection: DEFAULT_SORT_OPTIONS.direction,
      editorMode: WORKSPACE_MODE.EDITOR,
    })
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
      editorMode: WORKSPACE_MODE.VIEWER,
    })

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignId,
      editorMode: WORKSPACE_MODE.EDITOR,
    })

    const result = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignId,
    })
    expect(result!.sortOrder).toBe(SORT_ORDERS.Alphabetical)
    expect(result!.sortDirection).toBe(SORT_DIRECTIONS.Descending)
    expect(result!.editorMode).toBe(WORKSPACE_MODE.EDITOR)
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

  it('requires authentication and campaign membership', async () => {
    const ctx = await setupCampaignContext(t)
    const outsider = await setupUser(t)

    await expectNotAuthenticated(
      t.mutation(api.editors.mutations.setCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
    await expectPermissionDenied(
      outsider.authed.mutation(api.editors.mutations.setCurrentEditor, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})
