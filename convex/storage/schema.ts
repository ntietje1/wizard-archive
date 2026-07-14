import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'
import { assetIdValidator } from '../resources/validators'

export const fileStorageStatusValidator = literals('pending', 'uncommitted', 'committed')

const fileStorageCommonFields = {
  userId: v.id('userProfiles'),
  originalFileName: v.nullable(v.string()),
}

const pendingFileStorageFields = {
  ...fileStorageCommonFields,
  status: v.literal('pending'),
  assetUuid: v.null(),
  storageId: v.null(),
}

const uncommittedFileStorageFields = {
  ...fileStorageCommonFields,
  status: v.literal('uncommitted'),
  assetUuid: assetIdValidator,
  storageId: v.id('_storage'),
}

const committedFileStorageFields = {
  ...fileStorageCommonFields,
  status: v.literal('committed'),
  assetUuid: assetIdValidator,
  storageId: v.id('_storage'),
}

const fileStorageTableValidator = v.union(
  v.object(pendingFileStorageFields),
  v.object(uncommittedFileStorageFields),
  v.object(committedFileStorageFields),
)

export const fileStorageTables = {
  fileStorage: defineTable(fileStorageTableValidator)
    .index('by_assetUuid', ['assetUuid'])
    .index('by_storage', ['storageId'])
    .index('by_user_storage', ['userId', 'storageId']),
}

const fileStorageSystemFields = convexValidatorFields('fileStorage')

export const fileStorageValidator = v.union(
  v.object({ ...fileStorageSystemFields, ...pendingFileStorageFields }),
  v.object({ ...fileStorageSystemFields, ...uncommittedFileStorageFields }),
  v.object({ ...fileStorageSystemFields, ...committedFileStorageFields }),
)
