import type { Id, TableNames } from 'convex/_generated/dataModel'

/**
 * Creates a branded Convex Id for test data without scattering
 * `as Id<'table'>` casts across every test file.
 */
export function testId<T extends TableNames>(value: string): Id<T> {
  return value as Id<T>
}
