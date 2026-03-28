import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('generateUploadUrl', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    await expectNotAuthenticated(
      t.mutation(api.storage.mutations.generateUploadUrl, {}),
    )
  })

  it('generates a url for authenticated users', async () => {
    const { authed } = await setupUser(t)
    const url = await authed.mutation(
      api.storage.mutations.generateUploadUrl,
      {},
    )
    expect(url).toBeTypeOf('string')
  })
})

describe('trackUpload', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    await expectNotAuthenticated(
      t.mutation(api.storage.mutations.trackUpload, { storageId }),
    )
  })

  it('tracks an upload', async () => {
    const { authed } = await setupUser(t)
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })

    const id = await authed.mutation(api.storage.mutations.trackUpload, {
      storageId,
    })
    expect(id).toBeDefined()
  })
})

describe('commitUpload', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    await expectNotAuthenticated(
      t.mutation(api.storage.mutations.commitUpload, { storageId }),
    )
  })

  // convex-test storage mock does not preserve Blob contentType in system metadata
  it.skip('commits a tracked upload', async () => {
    // const { authed } = await setupUser(t)
    // const storageId = await t.run(async (ctx) => {
    //   return await ctx.storage.store(new Blob(['test'], { type: 'text/plain' }))
    // })
    // await authed.mutation(api.storage.mutations.trackUpload, { storageId })
    // const result = await authed.mutation(api.storage.mutations.commitUpload, { storageId })
    // expect(result).toBeDefined()
  })
})

describe('getDownloadUrl', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    await expectNotAuthenticated(
      t.query(api.storage.queries.getDownloadUrl, { storageId }),
    )
  })

  it('returns a download url for authenticated users', async () => {
    const { authed, profile } = await setupUser(t)
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    await t.run(async (ctx) => {
      await ctx.db.insert('fileStorage', {
        storageId,
        userId: profile._id,
        status: 'committed',
        originalFileName: 'test.txt',
        createdBy: profile._id,
        updatedTime: null,
        updatedBy: null,
        deletionTime: null,
        deletedBy: null,
      })
    })
    const url = await authed.query(api.storage.queries.getDownloadUrl, {
      storageId,
    })
    expect(url).toBeTypeOf('string')
  })
})

describe('getStorageMetadata', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    await expectNotAuthenticated(
      t.query(api.storage.queries.getStorageMetadata, { storageId }),
    )
  })

  it('returns metadata for authenticated users', async () => {
    const { authed } = await setupUser(t)
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })
    const metadata = await authed.query(
      api.storage.queries.getStorageMetadata,
      { storageId },
    )
    expect(metadata).toBeDefined()
  })
})
