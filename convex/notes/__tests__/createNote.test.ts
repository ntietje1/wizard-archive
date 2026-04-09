import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('createNote', () => {
  const t = createTestContext()

  it('creates a note with a unique slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'My Note',
      parentId: null,
    })

    expect(result.noteId).toBeDefined()
    expect(result.slug).toContain('my-note')

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get("notes", result.noteId)
      expect(note).not.toBeNull()
      expect(note!.name).toBe('My Note')
      expect(note!.parentId).toBeNull()
      expect(note!.campaignId).toBe(ctx.campaignId)
      expect(note!.type).toBe('note')
    })
  })

  it('creates a note inside a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Child Note',
      parentId: folderId,
    })

    expect(result.noteId).toBeDefined()

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get("notes", result.noteId)
      expect(note!.parentId).toBe(folderId)
    })
  })

  it('sets optional iconName and color', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Styled Note',
      parentId: null,
      iconName: 'scroll',
      color: '#ff0000',
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get("notes", result.noteId)
      expect(note!.iconName).toBe('scroll')
      expect(note!.color).toBe('#ff0000')
    })
  })

  it('player cannot create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Player Note',
        parentId: null,
      }),
    )
  })

  it('player with FULL_ACCESS on parent can create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Player Child Note',
      parentId: folderId,
    })
    expect(result.noteId).toBeDefined()
  })

  it('player with edit permission on parent cannot create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Child Note',
        parentId: folderId,
      }),
    )
  })

  it('validates empty name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '',
        parentId: null,
      }),
    )
  })

  it('validates whitespace-only name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '   ',
        parentId: null,
      }),
    )
  })

  it('validates name uniqueness under same parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Duplicate',
      parentId: null,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Duplicate',
        parentId: null,
      }),
    )
  })

  it('validates name uniqueness case-insensitively', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Duplicate',
      parentId: null,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'duplicate',
        parentId: null,
      }),
    )
  })

  it('allows same name under different parents', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Same Name',
      parentId: null,
    })

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Same Name',
      parentId: folderId,
    })
    expect(result.noteId).toBeDefined()
  })

  it('trims whitespace from name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: '  Padded Name  ',
      parentId: null,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get("notes", result.noteId)
      expect(note!.name).toBe('Padded Name')
    })
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentId: null,
      }),
    )
  })
})
