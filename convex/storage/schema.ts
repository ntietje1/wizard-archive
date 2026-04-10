import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { commonTableFields, commonValidatorFields } from '../common/schema'

export const fileStorageStatusValidator = literals('uncommitted', 'committed')

const fileStorageTableFields = {
  storageId: v.id('_storage'),
  userId: v.id('userProfiles'),
  status: fileStorageStatusValidator,
  originalFileName: v.nullable(v.string()),
}

export const fileStorageTables = {
  fileStorage: defineTable({
    ...commonTableFields,
    ...fileStorageTableFields,
  })
    .index('by_user_storage', ['userId', 'storageId'])
    .index('by_status', ['status']),
}

const fileStorageValidatorFields = {
  ...commonValidatorFields('fileStorage'),
  ...fileStorageTableFields,
}

export const fileStorageValidator = v.object(fileStorageValidatorFields)
