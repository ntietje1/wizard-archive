import { SORT_DIRECTIONS, SORT_ORDERS } from 'shared/editor/types'
import type { SortOptions } from 'shared/editor/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { assertNever } from '~/shared/utils/utils'

const NAME_COMPARE_OPTIONS = { numeric: true, sensitivity: 'base' } satisfies Intl.CollatorOptions

export const sortItemsByOptions = (
  options: SortOptions,
  items?: Array<AnySidebarItem>,
): Array<AnySidebarItem> | undefined => {
  if (!items) return undefined

  const sortFn = (a: AnySidebarItem, b: AnySidebarItem) => {
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
          ? a._creationTime - b._creationTime
          : b._creationTime - a._creationTime
      case SORT_ORDERS.DateModified: {
        const aTime = a.updatedTime ?? a._creationTime
        const bTime = b.updatedTime ?? b._creationTime
        return options.direction === SORT_DIRECTIONS.Ascending ? aTime - bTime : bTime - aTime
      }
      default:
        return assertNever(options.order)
    }
  }

  return [...items].sort(sortFn)
}
