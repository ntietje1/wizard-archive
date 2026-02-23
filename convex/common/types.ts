import type { Id, TableNames } from '../_generated/dataModel'

export type CommonTableFields = {
  _updatedTime: number
  _updatedBy: Id<'userProfiles'>
  _createdBy: Id<'userProfiles'>
}

export type CommonValidatorFields<T extends TableNames> = CommonTableFields & {
  _id: Id<T>
  _creationTime: number
}
