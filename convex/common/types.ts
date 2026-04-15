import type { Id, TableNames } from '../_generated/dataModel'

export type ConvexValidatorFields<T extends TableNames> = {
  _id: Id<T>
  _creationTime: number
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`)
}
