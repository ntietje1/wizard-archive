import { describe, expect, it } from 'vite-plus/test'
import { api } from '../../_generated/api'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { setupUser } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'
import type { Id } from '../../_generated/dataModel'

type TestContext = ReturnType<typeof createTestContext>
type AuthedClient = Awaited<ReturnType<typeof setupUser>>['authed']

describe('createUploadSession', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    await expectNotAuthenticated(t.mutation(api.storage.mutations.createUploadSession, {}))
  })

  it('creates a server-owned unbound upload session', async () => {
    const { authed, profile } = await setupUser(t)

    const result = await authed.mutation(api.storage.mutations.createUploadSession, {})

    expect(result.uploadUrl).toBeTypeOf('string')
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', result.sessionId)).resolves.toMatchObject({
        assetUuid: null,
        originalFileName: null,
        status: 'pending',
        storageId: null,
        userId: profile._id,
      })
    })
  })
})

describe('bindUpload', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const owner = await setupUser(t)
    const session = await owner.authed.mutation(api.storage.mutations.createUploadSession, {})
    const storageId = await storeTestFile(t)

    await expectNotAuthenticated(
      t.mutation(api.storage.mutations.bindUpload, {
        sessionId: session.sessionId,
        storageId,
      }),
    )
  })

  it('binds a newly uploaded file to its server-issued session', async () => {
    const { authed } = await setupUser(t)
    const { sessionId, storageId } = await createBoundUpload(t, authed, 'handout.txt')

    await t.run(async (ctx) => {
      const upload = await ctx.db.get('fileStorage', sessionId)
      expect(upload?.assetUuid && isUuidV7(upload.assetUuid)).toBe(true)
      const byAsset = upload?.assetUuid
        ? await ctx.db
            .query('fileStorage')
            .withIndex('by_assetUuid', (query) => query.eq('assetUuid', upload.assetUuid))
            .unique()
        : null
      expect(byAsset?._id).toBe(sessionId)
      await expect(ctx.db.get('fileStorage', sessionId)).resolves.toMatchObject({
        originalFileName: 'handout.txt',
        status: 'uncommitted',
        storageId,
      })
    })
  })

  it('returns the same session for an idempotent bind retry', async () => {
    const { authed } = await setupUser(t)
    const session = await authed.mutation(api.storage.mutations.createUploadSession, {})
    const storageId = await storeTestFile(t)
    const args = { sessionId: session.sessionId, storageId, originalFileName: 'handout.txt' }

    const first = await authed.mutation(api.storage.mutations.bindUpload, args)
    const second = await authed.mutation(api.storage.mutations.bindUpload, args)

    expect(second).toBe(first)
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query('fileStorage')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .collect()
      expect(rows).toHaveLength(1)
    })
  })

  it('does not let one session bind two storage objects', async () => {
    const { authed } = await setupUser(t)
    const session = await authed.mutation(api.storage.mutations.createUploadSession, {})
    const firstStorageId = await storeTestFile(t)
    const secondStorageId = await storeTestFile(t)
    await authed.mutation(api.storage.mutations.bindUpload, {
      sessionId: session.sessionId,
      storageId: firstStorageId,
    })

    await expect(
      authed.mutation(api.storage.mutations.bindUpload, {
        sessionId: session.sessionId,
        storageId: secondStorageId,
      }),
    ).rejects.toThrow('already bound')
  })

  it('rejects storage that predates the upload session', async () => {
    const { authed } = await setupUser(t)
    const storageId = await storeTestFile(t)
    const session = await authed.mutation(api.storage.mutations.createUploadSession, {})

    await expect(
      authed.mutation(api.storage.mutations.bindUpload, {
        sessionId: session.sessionId,
        storageId,
      }),
    ).rejects.toThrow('not created by this upload session')
  })

  it('does not let another session claim a known storage id', async () => {
    const owner = await setupUser(t)
    const otherUser = await setupUser(t)
    const upload = await createBoundUpload(t, owner.authed, 'private.txt')
    const otherSession = await otherUser.authed.mutation(
      api.storage.mutations.createUploadSession,
      {},
    )

    await expect(
      otherUser.authed.mutation(api.storage.mutations.bindUpload, {
        sessionId: otherSession.sessionId,
        storageId: upload.storageId,
      }),
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      await expect(ctx.storage.getUrl(upload.storageId)).resolves.toBeTypeOf('string')
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toMatchObject({
        storageId: upload.storageId,
        userId: owner.profile._id,
      })
      await expect(ctx.db.get('fileStorage', otherSession.sessionId)).resolves.toMatchObject({
        status: 'pending',
        storageId: null,
      })
    })
  })
})

describe('discardUpload', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const owner = await setupUser(t)
    const session = await owner.authed.mutation(api.storage.mutations.createUploadSession, {})
    await expectNotAuthenticated(
      t.mutation(api.storage.mutations.discardUpload, { sessionId: session.sessionId }),
    )
  })

  it('discards user-owned uncommitted storage and its session', async () => {
    const { authed } = await setupUser(t)
    const upload = await createBoundUpload(t, authed, 'malware.exe')

    await authed.mutation(api.storage.mutations.discardUpload, {
      sessionId: upload.sessionId,
    })

    await t.run(async (ctx) => {
      await expect(ctx.storage.getUrl(upload.storageId)).resolves.toBeNull()
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toBeNull()
    })
  })

  it('leaves another user upload untouched', async () => {
    const owner = await setupUser(t)
    const otherUser = await setupUser(t)
    const upload = await createBoundUpload(t, owner.authed, 'handout.txt')

    await otherUser.authed.mutation(api.storage.mutations.discardUpload, {
      sessionId: upload.sessionId,
    })

    await t.run(async (ctx) => {
      await expect(ctx.storage.getUrl(upload.storageId)).resolves.toBeTypeOf('string')
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it('refuses committed storage', async () => {
    const { authed, profile } = await setupUser(t)
    const storageId = await storeTestFile(t)
    const sessionId = await t.run(async (ctx) =>
      ctx.db.insert('fileStorage', {
        assetUuid: generateDomainId(DOMAIN_ID_KIND.asset),
        storageId,
        userId: profile._id,
        status: 'committed',
        originalFileName: 'test.txt',
      }),
    )

    await expect(
      authed.mutation(api.storage.mutations.discardUpload, { sessionId }),
    ).rejects.toThrow('Committed uploads cannot be discarded')
    await t.run(async (ctx) => {
      await expect(ctx.storage.getUrl(storageId)).resolves.toBeTypeOf('string')
    })
  })
})

describe('committed storage metadata reads', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const storageId = await storeTestFile(t)
    await expectNotAuthenticated(t.query(api.storage.queries.getStorageMetadata, { storageId }))
  })

  it('does not authorize reads from an uncommitted upload session', async () => {
    const { authed } = await setupUser(t)
    const upload = await createBoundUpload(t, authed, 'handout.txt')

    await expect(
      authed.query(api.storage.queries.getStorageMetadata, { storageId: upload.storageId }),
    ).resolves.toBeNull()
  })

  it('returns metadata for committed user storage', async () => {
    const { authed, profile } = await setupUser(t)
    const storageId = await storeTestFile(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('fileStorage', {
        assetUuid: generateDomainId(DOMAIN_ID_KIND.asset),
        storageId,
        userId: profile._id,
        status: 'committed',
        originalFileName: 'test.txt',
      })
    })

    await expect(
      authed.query(api.storage.queries.getStorageMetadata, { storageId }),
    ).resolves.toMatchObject({ originalFileName: 'test.txt' })
  })
})

async function createBoundUpload(t: TestContext, authed: AuthedClient, originalFileName: string) {
  const session = await authed.mutation(api.storage.mutations.createUploadSession, {})
  const storageId = await storeTestFile(t)
  await authed.mutation(api.storage.mutations.bindUpload, {
    originalFileName,
    sessionId: session.sessionId,
    storageId,
  })
  return { sessionId: session.sessionId, storageId }
}

async function storeTestFile(t: TestContext): Promise<Id<'_storage'>> {
  return await t.run(async (ctx) => ctx.storage.store(new Blob(['test'])))
}
