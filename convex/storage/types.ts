import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'

export const FILE_STORAGE_STATUS = {
  Pending: 'pending',
  Uncommitted: 'uncommitted',
  Committed: 'committed',
} as const

export type FileStorageStatus = (typeof FILE_STORAGE_STATUS)[keyof typeof FILE_STORAGE_STATUS]

export type FileStorage = ConvexValidatorFields<'fileStorage'> & {
  userId: Id<'userProfiles'>
  originalFileName: string | null
} & (
    | { status: typeof FILE_STORAGE_STATUS.Pending; storageId: null }
    | {
        storageId: Id<'_storage'>
        status: Exclude<FileStorageStatus, typeof FILE_STORAGE_STATUS.Pending>
      }
  )
