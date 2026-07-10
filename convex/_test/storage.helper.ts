import { FILE_STORAGE_STATUS } from '../storage/types'
import type { Id } from '../_generated/dataModel'
import type { createTestContext } from './setup.helper'

type TestContext = ReturnType<typeof createTestContext>

export async function storeCommittedTestUpload(
  t: TestContext,
  userId: Id<'userProfiles'>,
  blob: Blob,
  originalFileName: string,
) {
  return (await storeCommittedTestUploadSession(t, userId, blob, originalFileName)).storageId
}

export async function storeCommittedTestUploadSession(
  t: TestContext,
  userId: Id<'userProfiles'>,
  blob: Blob,
  originalFileName: string,
) {
  return await t.run(async (dbCtx) => {
    const storageId = await dbCtx.storage.store(blob)
    const sessionId = await dbCtx.db.insert('fileStorage', {
      storageId,
      userId,
      status: FILE_STORAGE_STATUS.Committed,
      originalFileName,
    })
    return { sessionId, storageId }
  })
}

export async function storeUncommittedTestUploadSession(
  t: TestContext,
  userId: Id<'userProfiles'>,
  blob: Blob,
  originalFileName: string,
) {
  return await t.run(async (dbCtx) => {
    const storageId = await dbCtx.storage.store(blob)
    const sessionId = await dbCtx.db.insert('fileStorage', {
      storageId,
      userId,
      status: FILE_STORAGE_STATUS.Uncommitted,
      originalFileName,
    })
    return { sessionId, storageId }
  })
}
