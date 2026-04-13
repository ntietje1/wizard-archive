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
  testBlockNoteId,
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
    const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('secret-block'),
    })

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

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'individually_shared',
    })
    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      campaignMemberId: p1.memberId,
    })

    const p1Note = await p1.authed.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(Object.keys(p1Note!.blockMeta)).toContain(block.blockNoteId)

    const p2Note = await p2.authed.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(Object.keys(p2Note!.blockMeta)).not.toContain(block.blockNoteId)

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      campaignMemberId: p2.memberId,
    })

    const p2NoteAfter = await p2.authed.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(Object.keys(p2NoteAfter!.blockMeta)).toContain(block.blockNoteId)
  })

  it('unsharing blocks reverts visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('revocable-block'),
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'all_shared',
    })

    const visibleNote = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(Object.keys(visibleNote!.blockMeta)).toContain(block.blockNoteId)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'not_shared',
    })

    const hiddenNote = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(Object.keys(hiddenNote!.blockMeta)).not.toContain(block.blockNoteId)
  })

  it('note inside shared folder inherits visibility but blocks still require explicit sharing', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Folder',
      inheritShares: true,
    })

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
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(playerNote).not.toBeNull()
    expect(playerNote!.name).toBe('Nested Note')

    const block = await createBlock(t, noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('nested-block'),
    })

    const playerNoteWithBlocks = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(Object.keys(playerNoteWithBlocks!.blockMeta)).not.toContain(block.blockNoteId)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId,
      blocks: [block.blockNoteId],
      status: 'all_shared',
    })

    const playerNoteShared = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId,
    })
    expect(Object.keys(playerNoteShared!.blockMeta)).toContain(block.blockNoteId)
  })

  it('removing sidebar share hides note entirely regardless of block shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      shareStatus: 'all_shared',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const before = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(before).not.toBeNull()
    expect(Object.keys(before!.blockMeta)).toContain(block.blockNoteId)

    await dmAuth.mutation(api.sidebarShares.mutations.unshareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      campaignMemberId: ctx.player.memberId,
    })

    const after = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })
    expect(after).toBeNull()
  })

  it('share status transitions: not_shared → all_shared → individually_shared → not_shared', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('transition-block'),
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const getVisibility = async () => {
      const n = await playerAuth.query(api.notes.queries.getNote, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
      })
      return Object.keys(n!.blockMeta).includes(block.blockNoteId)
    }

    expect(await getVisibility()).toBe(false)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'all_shared',
    })
    expect(await getVisibility()).toBe(true)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'individually_shared',
    })
    expect(await getVisibility()).toBe(false)

    await dmAuth.mutation(api.blockShares.mutations.shareBlocks, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      campaignMemberId: ctx.player.memberId,
    })
    expect(await getVisibility()).toBe(true)

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [block.blockNoteId],
      status: 'not_shared',
    })
    expect(await getVisibility()).toBe(false)
  })

  it('player sees nested shared blocks in blockMeta but not unshared siblings', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('root'),
      depth: 0,
      parentBlockId: null,
      position: 0,
    })
    await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('shared-child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
      position: 0,
    })
    await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id, {
      blockNoteId: testBlockNoteId('unshared-child'),
      depth: 1,
      parentBlockId: testBlockNoteId('root'),
      position: 1,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: note.noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.blockShares.mutations.setBlocksShareStatus, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
      blocks: [testBlockNoteId('root'), testBlockNoteId('shared-child')],
      status: 'all_shared',
    })

    const playerNote = await playerAuth.query(api.notes.queries.getNote, {
      campaignId: ctx.campaignId,
      noteId: note.noteId,
    })

    expect(playerNote).not.toBeNull()
    expect(playerNote!.blockMeta[testBlockNoteId('root')]).toBeDefined()
    expect(playerNote!.blockMeta[testBlockNoteId('shared-child')]).toBeDefined()
    expect(playerNote!.blockMeta[testBlockNoteId('unshared-child')]).toBeUndefined()
  })
})
