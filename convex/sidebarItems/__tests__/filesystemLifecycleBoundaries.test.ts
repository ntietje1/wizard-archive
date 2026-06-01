import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import type { FileSystemCommand } from '../../../shared/sidebar-items/filesystem/commands'
import type { Id } from '../../_generated/dataModel'
import { assertSidebarItemName } from '../validation/name'

describe('filesystem command lifecycle boundaries', () => {
  const t = createTestContext()
  const executeCommand = (
    dmAuth: ReturnType<typeof asDm>,
    campaignId: Id<'campaigns'>,
    command: FileSystemCommand,
  ) =>
    dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
      campaignId,
      command,
    })

  it('rejects move commands for trashed sources instead of restoring them implicitly', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: activeNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Active Note',
    })
    const { noteId: trashedNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Trashed Note',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    await expect(
      executeCommand(dmAuth, ctx.campaignId, {
        type: 'move',
        itemIds: [trashedNoteId],
        targetParentId: null,
      }),
    ).rejects.toThrow('Only active items can be moved')

    await expect(
      executeCommand(dmAuth, ctx.campaignId, {
        type: 'move',
        itemIds: [activeNoteId, trashedNoteId],
        targetParentId: null,
      }),
    ).rejects.toThrow('Only active items can be moved')

    const trashedNote = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', trashedNoteId))
    expect(trashedNote?.status).toBe('trashed')
  })

  it('rejects normal filesystem commands for undo-hidden source items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: hiddenNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Note',
      status: 'undoHidden',
    })

    const commandCases: Array<{ command: FileSystemCommand; message: string }> = [
      {
        command: {
          type: 'rename',
          itemId: hiddenNoteId,
          name: assertSidebarItemName('Renamed Hidden Note'),
        },
        message: 'Only active items can be renamed',
      },
      {
        command: { type: 'move', itemIds: [hiddenNoteId], targetParentId: null },
        message: 'Only active items can be moved',
      },
      {
        command: { type: 'trash', itemIds: [hiddenNoteId] },
        message: 'Only active or trashed items can be used as sources for trash actions',
      },
      {
        command: { type: 'copy', itemIds: [hiddenNoteId], targetParentId: null },
        message: 'Only active sidebar items can be copied',
      },
      {
        command: { type: 'restore', itemIds: [hiddenNoteId], targetParentId: null },
        message: 'Only trashed items can be restored',
      },
    ]

    for (const { command, message } of commandCases) {
      await expect(executeCommand(dmAuth, ctx.campaignId, command)).rejects.toThrow(message)
    }

    const hiddenNote = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', hiddenNoteId))
    expect(hiddenNote?.status).toBe('undoHidden')
  })

  it('rejects oversized tree operations before mutating roots', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: rootFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Deep Root',
    })
    let parentId = rootFolderId
    // 51 descendants exceeds the max sidebar move planning depth enforced by the planner.
    for (let index = 0; index < 51; index += 1) {
      const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Deep Child ${index}`,
        parentId,
      })
      parentId = folderId
    }

    await expect(
      executeCommand(dmAuth, ctx.campaignId, { type: 'trash', itemIds: [rootFolderId] }),
    ).rejects.toThrow('Max sidebar move planning depth exceeded')

    const rootFolder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', rootFolderId))
    expect(rootFolder?.status).toBe('active')
  })

  it('rejects permanent delete when one selected folder exceeds the affected-row limit', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Large Trash Folder',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })
    for (let index = 0; index < 100; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Trashed Child ${index}`,
        parentId: folderId,
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    }

    await expect(
      executeCommand(dmAuth, ctx.campaignId, {
        type: 'deleteForever',
        itemIds: [folderId],
      }),
    ).rejects.toThrow('Permanent delete can delete at most 100 items at once')

    const folder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', folderId))
    expect(folder?.status).toBe('trashed')
  })

  it('rejects empty trash when one folder subtree exceeds the affected-row limit', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Large Trash Folder',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })
    for (let index = 0; index < 100; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Trashed Child ${index}`,
        parentId: folderId,
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    }

    await expect(executeCommand(dmAuth, ctx.campaignId, { type: 'emptyTrash' })).rejects.toThrow(
      'Empty Trash can delete at most 100 items at once',
    )

    const folder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', folderId))
    expect(folder?.status).toBe('trashed')
  })

  it('rejects copy and move decisions that do not correspond to actual conflicts', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source',
    })
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Destination',
    })

    for (const action of ['skip', 'replace', 'keepBoth'] as const) {
      await expect(
        dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
          campaignId: ctx.campaignId,
          command: { type: 'copy', itemIds: [noteId], targetParentId: folderId },
          decisions: [{ sourceItemId: noteId, action }],
        }),
      ).rejects.toThrow('Conflict decision does not match an item with a conflict')

      await expect(
        dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
          campaignId: ctx.campaignId,
          command: { type: 'move', itemIds: [noteId], targetParentId: folderId },
          decisions: [{ sourceItemId: noteId, action }],
        }),
      ).rejects.toThrow('Conflict decision does not match an item with a conflict')
    }

    const note = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', noteId))
    expect(note?.parentId).toBeNull()
  })
})
