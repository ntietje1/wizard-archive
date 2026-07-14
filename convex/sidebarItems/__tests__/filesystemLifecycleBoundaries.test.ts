import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import type { ResourceCommand } from '@wizard-archive/editor/resources/transaction-contract'
import { assertConvexResourceTitle } from '../validation/name'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

describe('filesystem command lifecycle boundaries', () => {
  const t = createTestContext()
  const executeCommand = (
    dmAuth: ReturnType<typeof asDm>,
    campaignId: CampaignId,
    command: ResourceCommand,
  ) =>
    executeTestFileSystemCommand(dmAuth, {
      campaignId,
      command,
    })

  it('rejects move commands for trashed sources instead of restoring them implicitly', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: activeNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Active Note',
    })
    const { noteId: trashedNoteId, noteRowId: trashedNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Trashed Note',
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.memberDomainId,
      },
    )

    await expect(
      executeCommand(dmAuth, ctx.campaignDomainId, {
        type: 'move',
        itemIds: [trashedNoteId],
        targetParentId: null,
      }),
    ).rejects.toThrow('Only active items can be moved')

    await expect(
      executeCommand(dmAuth, ctx.campaignDomainId, {
        type: 'move',
        itemIds: [activeNoteId, trashedNoteId],
        targetParentId: null,
      }),
    ).rejects.toThrow('Only active items can be moved')

    const trashedNote = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', trashedNoteRowId))
    expect(trashedNote?.status).toBe('trashed')
  })

  it('rejects normal filesystem commands for undo-hidden source items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: hiddenNoteId, noteRowId: hiddenNoteRowId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Hidden Note',
        status: 'undoHidden',
      },
    )

    const commandCases: Array<{ command: ResourceCommand; message: string }> = [
      {
        command: {
          type: 'rename',
          itemId: hiddenNoteId,
          name: assertConvexResourceTitle('Renamed Hidden Note'),
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
      await expect(executeCommand(dmAuth, ctx.campaignDomainId, command)).rejects.toThrow(message)
    }

    const hiddenNote = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', hiddenNoteRowId))
    expect(hiddenNote?.status).toBe('undoHidden')
  })

  it('rejects oversized tree operations before mutating roots', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: rootFolderId, folderRowId: rootFolderRowId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Deep Root',
      },
    )
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
      executeCommand(dmAuth, ctx.campaignDomainId, { type: 'trash', itemIds: [rootFolderId] }),
    ).rejects.toThrow('Max sidebar tree depth exceeded')

    const rootFolder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', rootFolderRowId))
    expect(rootFolder?.status).toBe('active')
  })

  it('rejects permanent delete when one selected folder exceeds the affected-row limit', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Large Trash Folder',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.memberDomainId,
    })
    for (let index = 0; index < 100; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Trashed Child ${index}`,
        parentId: folderId,
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.memberDomainId,
      })
    }

    await expect(
      executeCommand(dmAuth, ctx.campaignDomainId, {
        type: 'deleteForever',
        itemIds: [folderId],
      }),
    ).rejects.toThrow('Permanent delete can delete at most 100 items at once')

    const folder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', folderRowId))
    expect(folder?.status).toBe('trashed')
  })

  it('rejects empty trash when one folder subtree exceeds the affected-row limit', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Large Trash Folder',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.memberDomainId,
    })
    for (let index = 0; index < 100; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Trashed Child ${index}`,
        parentId: folderId,
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.memberDomainId,
      })
    }

    await expect(
      executeCommand(dmAuth, ctx.campaignDomainId, { type: 'emptyTrash' }),
    ).rejects.toThrow('Empty Trash can delete at most 100 items at once')

    const folder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', folderRowId))
    expect(folder?.status).toBe('trashed')
  })
})
