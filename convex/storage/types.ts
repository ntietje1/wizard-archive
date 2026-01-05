import type { Id } from '../_generated/dataModel'

export type FileStorage = {
  _id: Id<'fileStorage'>
  _creationTime: number
  userId: Id<'userProfiles'>
  storageId: Id<'_storage'>
  status: FileStorageStatus
  originalFileName?: string
}

export const FILE_STORAGE_STATUS = {
  Uncommitted: 'uncommitted',
  Committed: 'committed',
} as const

export type FileStorageStatus =
  (typeof FILE_STORAGE_STATUS)[keyof typeof FILE_STORAGE_STATUS]
