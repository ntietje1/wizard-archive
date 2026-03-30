import type { Id, TableNames } from '../_generated/dataModel'

export function testId<T extends TableNames>(value: string): Id<T> {
  return value as Id<T>
}
