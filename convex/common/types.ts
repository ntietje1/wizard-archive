import type { Id, TableNames } from '../_generated/dataModel'

export type CommonTableFields = {
  updatedTime: number
  updatedBy: Id<'userProfiles'>
  createdBy: Id<'userProfiles'>
  deletionTime?: number
  deletedBy?: Id<'userProfiles'>
}

export type ConvexValidatorFields<T extends TableNames> = {
  _id: Id<T>
  _creationTime: number
}

export type CommonValidatorFields<T extends TableNames> = CommonTableFields &
  ConvexValidatorFields<T>
