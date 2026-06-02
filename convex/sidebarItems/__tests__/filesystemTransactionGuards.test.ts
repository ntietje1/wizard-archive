import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createCampaignWithDm, createFolder, createNote } from '../../_test/factories.helper'

describe('filesystem transaction guards', () => {
  const t = createTestContext()

  it('uses status for active and trash queries while keeping location as sidebar', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Active' })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Trashed',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const active = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    const trashed = await dmAuth.query(api.sidebarItems.queries.getTrashedSidebarItems, {
      campaignId: ctx.campaignId,
    })

    expect(active.map((item) => item.name)).toEqual(['Active'])
    expect(active[0]).toMatchObject({ status: 'active', location: 'sidebar' })
    expect(trashed.map((item) => item.name)).toEqual(['Trashed'])
    expect(trashed[0]).toMatchObject({ status: 'trashed', location: 'sidebar' })
  })

  it('rejects filesystem commands that reference another campaign item or parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const { noteId: localNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local',
    })
    const { folderId: otherFolderId } = await createFolder(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Folder' },
    )
    const { noteId: otherNoteId } = await createNote(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Note' },
    )
    const { noteId: otherTrashedNoteId } = await createNote(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Other Trash',
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      },
    )

    const commands = [
      { type: 'rename' as const, itemId: otherNoteId, name: 'Renamed' },
      { type: 'move' as const, itemIds: [otherNoteId], targetParentId: null },
      { type: 'trash' as const, itemIds: [otherNoteId] },
      { type: 'copy' as const, itemIds: [otherNoteId], targetParentId: null },
      { type: 'restore' as const, itemIds: [otherTrashedNoteId], targetParentId: null },
      { type: 'deleteForever' as const, itemIds: [otherTrashedNoteId] },
      { type: 'move' as const, itemIds: [localNoteId], targetParentId: otherFolderId },
      { type: 'copy' as const, itemIds: [localNoteId], targetParentId: otherFolderId },
    ]

    for (const command of commands) {
      await expect(
        dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
          campaignId: ctx.campaignId,
          command,
        }),
      ).rejects.toThrow()
    }

    const otherItems = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: otherCampaign.campaignId,
    })
    expect(otherItems.map((item) => item.name).sort()).toEqual(['Other Folder', 'Other Note'])
  })

  it('keeps undo-hidden items out of direct queries and active parent targets', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: hiddenFolderId, slug: hiddenFolderSlug } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Hidden',
        status: 'undoHidden',
      },
    )
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Visible',
    })

    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: hiddenFolderId,
      }),
    ).rejects.toThrow('This item could not be found')
    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
        campaignId: ctx.campaignId,
        slug: hiddenFolderSlug,
      }),
    ).resolves.toBeNull()

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'note',
          name: 'Child',
          parentTarget: { kind: 'direct', parentId: hiddenFolderId },
        },
      }),
    ).rejects.toThrow('Parent not found')
    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: { type: 'move', itemIds: [noteId], targetParentId: hiddenFolderId },
      }),
    ).rejects.toThrow('Parent not found')
  })
})
