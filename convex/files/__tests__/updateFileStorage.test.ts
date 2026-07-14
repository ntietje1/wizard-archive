import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { createFile, createSidebarShare } from '../../_test/factories.helper'
import { asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'

describe('updateFileStorage', () => {
  const t = createTestContext()

  it('player with edit share can replace file storage', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { fileId, fileRowId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId, storageId } = await storeCommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['updated file'], { type: 'text/plain' }),
      'updated.txt',
    )

    await playerAuth.mutation(api.files.mutations.updateFileStorage, {
      campaignId: ctx.campaignDomainId,
      fileId,
      uploadSessionId: sessionId,
    })

    await t.run(async (dbCtx) => {
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileRowId))
        .unique()
      const fileItem = await dbCtx.db.get('sidebarItems', fileRowId)

      expect(fileExt!.storageId).toBe(storageId)
      expect(fileItem!.previewStorageId).toBeNull()
      expect(fileItem!.updatedBy).toBe(ctx.player.memberDomainId)
    })
  })

  it('player with view share cannot replace file storage', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['updated file']),
      'updated.txt',
    )

    await expectPermissionDenied(
      playerAuth.mutation(api.files.mutations.updateFileStorage, {
        campaignId: ctx.campaignDomainId,
        fileId,
        uploadSessionId: sessionId,
      }),
    )
    await t.run(async (dbCtx) => {
      await expect(dbCtx.db.get('fileStorage', sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it("rejects another actor's upload session", async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['updated file'], { type: 'text/plain' }),
      'updated.txt',
    )

    await expectNotFound(
      playerAuth.mutation(api.files.mutations.updateFileStorage, {
        campaignId: ctx.campaignDomainId,
        fileId,
        uploadSessionId: sessionId,
      }),
    )
  })

  it('commits and attaches an uncommitted upload in one mutation', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { fileId, fileRowId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const session = await playerAuth.mutation(api.storage.mutations.createUploadSession, {})
    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['updated file'], { type: 'text/plain' }))
    })
    await playerAuth.mutation(api.storage.mutations.bindUpload, {
      sessionId: session.sessionId,
      storageId,
      originalFileName: 'updated.txt',
    })

    await playerAuth.mutation(api.files.mutations.updateFileStorage, {
      campaignId: ctx.campaignDomainId,
      fileId,
      uploadSessionId: session.sessionId,
    })

    await t.run(async (dbCtx) => {
      await expect(dbCtx.db.get('fileStorage', session.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
      const file = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileRowId))
        .unique()
      expect(file?.storageId).toBe(storageId)
    })
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.files.mutations.updateFileStorage, {
        campaignId: ctx.campaignDomainId,
        fileId,
        uploadSessionId: null,
      }),
    )
  })
})
