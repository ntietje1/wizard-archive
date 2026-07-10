import { SORT_DIRECTIONS, SORT_ORDERS } from '../../items-persistence-contract'
import type { AnyItem } from '../../items'
import type { SortOptions } from '../../items-persistence-contract'
import { assertNever } from './assert-never'

const NAME_COMPARE_OPTIONS = { numeric: true, sensitivity: 'base' } satisfies Intl.CollatorOptions

export const sortItemsByOptions = (
  options: SortOptions,
  items: ReadonlyArray<AnyItem>,
): Array<AnyItem> => {
  const sortFn = (a: AnyItem, b: AnyItem) => {
    switch (options.order) {
      case SORT_ORDERS.Alphabetical: {
        const nameA = a.name
        const nameB = b.name
        return options.direction === SORT_DIRECTIONS.Ascending
          ? nameA.localeCompare(nameB, undefined, NAME_COMPARE_OPTIONS)
          : nameB.localeCompare(nameA, undefined, NAME_COMPARE_OPTIONS)
      }
      case SORT_ORDERS.DateCreated:
        return options.direction === SORT_DIRECTIONS.Ascending
          ? a.createdAt - b.createdAt
          : b.createdAt - a.createdAt
      case SORT_ORDERS.DateModified: {
        const aTime = a.updatedTime ?? a.createdAt
        const bTime = b.updatedTime ?? b.createdAt
        return options.direction === SORT_DIRECTIONS.Ascending ? aTime - bTime : bTime - aTime
      }
      default:
        return assertNever(options.order, 'Unhandled sidebar sort order')
    }
  }

  return [...items].sort(sortFn)
}
