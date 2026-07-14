import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import {
  addPlayerToCampaign,
  createCampaignWithDm,
  createUserProfile,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { assertUndoablePatch } from '../filesystem/deltas'
import type { ResourcePatch } from '@wizard-archive/editor/resources/patch-contract'
import { testOperationId } from '../../../shared/test/operation-id'

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

    const { active, trash: trashed } = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItems,
      {
        campaignId: ctx.campaignId,
      },
    )

    expect(active.map((item) => item.name)).toEqual(['Active'])
    expect(active[0]).toMatchObject({ status: 'active', location: 'sidebar' })
    expect(trashed.map((item) => item.name)).toEqual(['Trashed'])
    expect(trashed[0]).toMatchObject({ status: 'trashed', location: 'sidebar' })
  })

  it('rejects receipt-only filesystem patch types during undo replay', () => {
    const unsupportedPatch = { type: 'upsertResource' } as unknown as ResourcePatch

    expect(() => assertUndoablePatch(unsupportedPatch)).toThrow('Filesystem patch is not undoable')
  })

  it('rejects transaction replay upserts for related rows targeting another campaign item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const { noteId: localNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local',
    })
    const { noteId: otherNoteId } = await createNote(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Note' },
    )
    const share = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: localNoteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const transactionId = testOperationId('foreign-related-row-upserts')
    await t.run(async (dbCtx) => {
      const shareRow = await dbCtx.db.get('sidebarItemShares', share.shareId)
      if (!shareRow) throw new Error('Missing setup share')

      await dbCtx.db.insert('filesystemTransactions', {
        campaignId: ctx.campaignId,
        actorMemberId: ctx.dm.memberId,
        operationUuid: transactionId,
        requestFingerprint: 'foreign-related-row-upserts',
        command: { type: 'toggleBookmarks', itemIds: [localNoteId] },
        events: [],
        changes: [
          {
            type: 'insertResourceShare',
            after: { ...shareRow, sidebarItemId: otherNoteId },
          },
          {
            type: 'updateResourceBookmarkState',
            itemId: otherNoteId,
            campaignMemberId: ctx.dm.memberId,
            before: false,
            after: true,
          },
        ],
        undoable: true,
      })
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId,
      }),
    ).rejects.toThrow('Filesystem item no longer exists')

    const relatedRows = await t.run(async (dbCtx) => {
      const [shares, bookmarks] = await Promise.all([
        dbCtx.db
          .query('sidebarItemShares')
          .withIndex('by_campaign_item_member', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('sidebarItemId', otherNoteId)
              .eq('campaignMemberId', ctx.player.memberId),
          )
          .collect(),
        dbCtx.db
          .query('bookmarks')
          .withIndex('by_campaign_member_item', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('campaignMemberId', ctx.dm.memberId)
              .eq('sidebarItemId', otherNoteId),
          )
          .collect(),
      ])
      return { shares, bookmarks }
    })
    expect(relatedRows).toEqual({ shares: [], bookmarks: [] })
  })

  it('rejects transaction replay share upserts for members outside the current campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherPlayer = await createUserProfile(t)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const otherMember = await addPlayerToCampaign(t, otherCampaign.campaignId, otherPlayer)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local',
    })
    const share = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const transactionId = testOperationId('foreign-share-member-upsert')
    await t.run(async (dbCtx) => {
      const shareRow = await dbCtx.db.get('sidebarItemShares', share.shareId)
      if (!shareRow) throw new Error('Missing setup share')

      await dbCtx.db.insert('filesystemTransactions', {
        campaignId: ctx.campaignId,
        actorMemberId: ctx.dm.memberId,
        operationUuid: transactionId,
        requestFingerprint: 'foreign-share-member-upsert',
        command: {
          type: 'setResourcesMemberPermission',
          itemIds: [noteId],
          campaignMemberId: ctx.player.memberId,
          permissionLevel: 'view',
        },
        events: [],
        changes: [
          {
            type: 'insertResourceShare',
            after: { ...shareRow, campaignMemberId: otherMember.memberId },
          },
        ],
        undoable: true,
      })
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId,
      }),
    ).rejects.toThrow('Filesystem transaction can no longer be applied cleanly')

    const foreignShares = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('sidebarItemShares')
        .withIndex('by_campaign_item_member', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('sidebarItemId', noteId)
            .eq('campaignMemberId', otherMember.memberId),
        )
        .collect()
    })
    expect(foreignShares).toEqual([])
  })

  it('applies bookmark replay state to the actor instead of trusting stored member ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherPlayer = await createUserProfile(t)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const otherMember = await addPlayerToCampaign(t, otherCampaign.campaignId, otherPlayer)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local',
    })

    const transactionId = testOperationId('foreign-bookmark-member-upsert')
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('filesystemTransactions', {
        campaignId: ctx.campaignId,
        actorMemberId: ctx.dm.memberId,
        operationUuid: transactionId,
        requestFingerprint: 'foreign-bookmark-member-upsert',
        command: { type: 'toggleBookmarks', itemIds: [noteId] },
        events: [],
        changes: [
          {
            type: 'updateResourceBookmarkState',
            itemId: noteId,
            campaignMemberId: otherMember.memberId,
            before: false,
            after: true,
          },
        ],
        undoable: true,
      })
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId,
    })

    const bookmarks = await t.run(async (dbCtx) => {
      const [actorBookmarks, foreignBookmarks] = await Promise.all([
        dbCtx.db
          .query('bookmarks')
          .withIndex('by_campaign_member_item', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('campaignMemberId', ctx.dm.memberId)
              .eq('sidebarItemId', noteId),
          )
          .collect(),
        dbCtx.db
          .query('bookmarks')
          .withIndex('by_campaign_member_item', (q) =>
            q
              .eq('campaignId', ctx.campaignId)
              .eq('campaignMemberId', otherMember.memberId)
              .eq('sidebarItemId', noteId),
          )
          .collect(),
      ])
      return { actorBookmarks, foreignBookmarks }
    })
    expect(bookmarks.actorBookmarks).toHaveLength(1)
    expect(bookmarks.foreignBookmarks).toEqual([])
  })

  it('rejects transaction replay folder-share patches outside the current campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const { folderId: otherFolderId } = await createFolder(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Folder' },
    )

    const transactionId = testOperationId('foreign-folder-share-patch')
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('filesystemTransactions', {
        campaignId: ctx.campaignId,
        actorMemberId: ctx.dm.memberId,
        operationUuid: transactionId,
        requestFingerprint: 'foreign-folder-share-patch',
        command: {
          type: 'setFolderInheritShares',
          folderId: otherFolderId,
          inheritShares: true,
        },
        events: [],
        changes: [
          {
            type: 'updateFolderShare',
            before: { folderId: otherFolderId, inheritShares: false },
            after: { folderId: otherFolderId, inheritShares: true },
          },
        ],
        undoable: true,
      })
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId,
      }),
    ).rejects.toThrow('Filesystem item no longer exists')

    const otherFolder = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', otherFolderId))
        .unique()
    })
    expect(otherFolder?.inheritShares).toBe(false)
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
        executeTestFileSystemCommand(dmAuth, {
          campaignId: ctx.campaignId,
          command,
        }),
      ).rejects.toThrow()
    }

    const { active: otherItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
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
      executeTestFileSystemCommand(dmAuth, {
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
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignId,
        command: { type: 'move', itemIds: [noteId], targetParentId: hiddenFolderId },
      }),
    ).rejects.toThrow('Parent not found')
  })
})
