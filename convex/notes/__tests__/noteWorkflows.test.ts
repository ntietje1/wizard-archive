import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
import {
  createBlock,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('note lifecycle: create, share, edit, block sharing', () => {
  const t = createTestContext()

  it('multi-player: individually shared blocks are only visible to targeted players', async () => {
    const ctx = await setupMultiPlayerContext(t, 2)
    const dmAuth = ctx.dm.authed
    const p1 = ctx.players[0]
    const p2 = ctx.players[1]

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Secrets',
    })
    const block = await createBlock(
      t,
      note.noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { blockId: 'secret-block' },
    )

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
    })
    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: p2.memberId,
    })

    const blockContent = {
      blockNoteId: block.blockId,
      content: { id: block.blockId, type: 'paragraph' as const, content: [] },
    }

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockContent],
      status: 'individually_shared',
    })
    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      noteId: note.noteId,
      blocks: [blockContent],
      campaignMemberId: p1.memberId,
    })

    const p1Note = await p1.authed.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(Object.keys(p1Note!.blockMeta)).toContain(block.blockId)

    const p2Note = await p2.authed.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(Object.keys(p2Note!.blockMeta)).not.toContain(block.blockId)

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      noteId: note.noteId,
      blocks: [blockContent],
      campaignMemberId: p2.memberId,
    })

    const p2NoteAfter = await p2.authed.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(Object.keys(p2NoteAfter!.blockMeta)).toContain(block.blockId)
  })

  it('unsharing blocks reverts visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(
      t,
      note.noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { blockId: 'revocable-block' },
    )

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const blockContent = {
      blockNoteId: block.blockId,
      content: { id: block.blockId, type: 'paragraph' as const, content: [] },
    }

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockContent],
      status: 'all_shared',
    })

    const visibleNote = await playerAuth.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(Object.keys(visibleNote!.blockMeta)).toContain(block.blockId)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockContent],
      status: 'not_shared',
    })

    const hiddenNote = await playerAuth.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(Object.keys(hiddenNote!.blockMeta)).not.toContain(block.blockId)
  })

  it('note inside shared folder inherits visibility but blocks still require explicit sharing', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Shared Folder', inheritShares: true },
    )

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Nested Note',
      parentId: folderId,
    })

    const playerNote = await playerAuth.query(api.notes.queries.getNote, {
      noteId,
    })
    expect(playerNote).not.toBeNull()
    expect(playerNote!.name).toBe('Nested Note')

    const block = await createBlock(
      t,
      noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { blockId: 'nested-block' },
    )

    const playerNoteWithBlocks = await playerAuth.query(
      api.notes.queries.getNote,
      { noteId },
    )
    expect(Object.keys(playerNoteWithBlocks!.blockMeta)).not.toContain(
      block.blockId,
    )

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId,
      blocks: [
        {
          blockNoteId: block.blockId,
          content: {
            id: block.blockId,
            type: 'paragraph' as const,
            content: [],
          },
        },
      ],
      status: 'all_shared',
    })

    const playerNoteShared = await playerAuth.query(api.notes.queries.getNote, {
      noteId,
    })
    expect(Object.keys(playerNoteShared!.blockMeta)).toContain(block.blockId)
  })

  it('removing sidebar share hides note entirely regardless of block shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(
      t,
      note.noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { shareStatus: 'all_shared' },
    )

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const before = await playerAuth.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(before).not.toBeNull()
    expect(Object.keys(before!.blockMeta)).toContain(block.blockId)

    await dmAuth.mutation(api.sidebarShares.mutations.unshareSidebarItem, {
      sidebarItemId: note.noteId,
      campaignMemberId: ctx.player.memberId,
    })

    const after = await playerAuth.query(api.notes.queries.getNote, {
      noteId: note.noteId,
    })
    expect(after).toBeNull()
  })

  it('share status transitions: not_shared → all_shared → individually_shared → not_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(
      t,
      note.noteId,
      ctx.campaignId,
      ctx.dm.profile._id,
      { blockId: 'transition-block' },
    )

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const blockRef = {
      blockNoteId: block.blockId,
      content: { id: block.blockId, type: 'paragraph' as const, content: [] },
    }

    const getVisibility = async () => {
      const n = await playerAuth.query(api.notes.queries.getNote, {
        noteId: note.noteId,
      })
      return Object.keys(n!.blockMeta).includes(block.blockId)
    }

    expect(await getVisibility()).toBe(false)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockRef],
      status: 'all_shared',
    })
    expect(await getVisibility()).toBe(true)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockRef],
      status: 'individually_shared',
    })
    expect(await getVisibility()).toBe(false)

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      noteId: note.noteId,
      blocks: [blockRef],
      campaignMemberId: ctx.player.memberId,
    })
    expect(await getVisibility()).toBe(true)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      noteId: note.noteId,
      blocks: [blockRef],
      status: 'not_shared',
    })
    expect(await getVisibility()).toBe(false)
  })
})
