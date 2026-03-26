import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export const FILE_STORAGE_STATUS = {
  Uncommitted: 'uncommitted',
  Committed: 'committed',
} as const

export type FileStorageStatus =
  (typeof FILE_STORAGE_STATUS)[keyof typeof FILE_STORAGE_STATUS]

export type FileStorage = CommonValidatorFields<'fileStorage'> & {
  userId: Id<'userProfiles'>
  storageId: Id<'_storage'>
  status: FileStorageStatus
  originalFileName: string | null
}
