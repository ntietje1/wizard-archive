import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createBlock, createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('getNote', () => {
  const t = createTestContext()

  it('returns note with content and ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Test Note',
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.notes.queries.getNote, { noteId })

    expect(result).not.toBeNull()
    expect(result!._id).toBe(noteId)
    expect(result!.name).toBe('Test Note')
    expect(Array.isArray(result!.ancestors)).toBe(true)
    expect(Array.isArray(result!.content)).toBe(true)
    expect(result!.blockMeta).not.toBeNull()
    expect(typeof result!.blockMeta).toBe('object')
    expect(Array.isArray(result!.blockMeta)).toBe(false)
  })

  it('returns null for nonexistent note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: realNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete(realNoteId)
    })

    const result = await dmAuth.query(api.notes.queries.getNote, {
      noteId: realNoteId,
    })
    expect(result).toBeNull()
  })

  it('returns note for player with explicit access', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Note',
    })
    await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const result = await playerAuth.query(api.notes.queries.getNote, { noteId })

    expect(result).not.toBeNull()
    expect(result!._id).toBe(noteId)
    expect(result!.name).toBe('Shared Note')
    expect(Array.isArray(result!.ancestors)).toBe(true)
    expect(Array.isArray(result!.content)).toBe(true)
    expect(result!.blockMeta).not.toBeNull()
    expect(typeof result!.blockMeta).toBe('object')
    expect(Array.isArray(result!.blockMeta)).toBe(false)
  })

  it('returns null for player without access to soft-deleted note', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const result = await playerAuth.query(api.notes.queries.getNote, {
      noteId,
    })
    expect(result).toBeNull()
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(t.query(api.notes.queries.getNote, { noteId }))
  })
})

describe('updateNote', () => {
  const t = createTestContext()

  it('updates name and regenerates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original',
    })

    const result = await dmAuth.mutation(api.notes.mutations.updateNote, {
      noteId,
      name: 'Renamed Note',
    })

    expect(result.noteId).toBe(noteId)
    expect(result.slug).toContain('renamed-note')

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
      expect(note!.name).toBe('Renamed Note')
    })
  })

  it('updates iconName', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.notes.mutations.updateNote, {
      noteId,
      iconName: 'scroll',
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
      expect(note!.iconName).toBe('scroll')
    })
  })

  it('updates color', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.notes.mutations.updateNote, {
      noteId,
      color: '#ff0000',
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
      expect(note!.color).toBe('#ff0000')
    })
  })

  it('validates name uniqueness under same parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Existing',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Other',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.updateNote, {
        noteId,
        name: 'Existing',
      }),
    )
  })

  it('allows player with FULL_ACCESS share to update', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Note',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.notes.mutations.updateNote, {
      noteId,
      name: 'Player Renamed',
    })
    expect(result.noteId).toBe(noteId)

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
      expect(note!.name).toBe('Player Renamed')
    })
  })

  it('rejects player with EDIT permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Edit Only Note',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.updateNote, {
        noteId,
        name: 'Hacked',
      }),
    )
  })

  it('rejects player with VIEW permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'View Only Note',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.updateNote, {
        noteId,
        name: 'Hacked',
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.notes.mutations.updateNote, {
        noteId,
        name: 'Nope',
      }),
    )
  })
})
