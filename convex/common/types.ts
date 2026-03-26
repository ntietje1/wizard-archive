import { throwServerError } from '../errors'
import type { Id, TableNames } from '../_generated/dataModel'

export type CommonTableFields = {
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
}

export type ConvexValidatorFields<T extends TableNames> = {
  _id: Id<T>
  _creationTime: number
}

export type CommonValidatorFields<T extends TableNames> = CommonTableFields &
  ConvexValidatorFields<T>

export function assertNever(value: never): never {
  throwServerError(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`,
  )
}
