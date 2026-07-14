import { FILE_STORAGE_STATUS } from '../storage/types'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
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
    const assetId = generateDomainId(DOMAIN_ID_KIND.asset)
    const sessionId = await dbCtx.db.insert('fileStorage', {
      assetUuid: assetId,
      storageId,
      userId,
      status: FILE_STORAGE_STATUS.Committed,
      originalFileName,
    })
    return { assetId, sessionId, storageId }
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
    const assetId = generateDomainId(DOMAIN_ID_KIND.asset)
    const sessionId = await dbCtx.db.insert('fileStorage', {
      assetUuid: assetId,
      storageId,
      userId,
      status: FILE_STORAGE_STATUS.Uncommitted,
      originalFileName,
    })
    return { assetId, sessionId, storageId }
  })
}
