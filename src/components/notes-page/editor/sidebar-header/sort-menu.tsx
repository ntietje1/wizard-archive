import { SORT_DIRECTIONS, SORT_ORDERS } from 'convex/editors/types'
import type { SortDirection, SortOrder } from 'convex/editors/types'
import { Button } from '~/components/shadcn/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/shadcn/ui/dropdown-menu'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  ClockArrowDown,
  ClockArrowUp,
  SortAsc,
  SortDesc,
} from '~/lib/icons'
import { useSortOptions } from '~/hooks/useSortOptions'
import { EmptyContextMenu } from '~/components/context-menu/components/EmptyContextMenu'

export function SortMenu() {
  const { sortOptions, setSortOptions } = useSortOptions()

  const handleSortOrderChange = (value: string) => {
    setSortOptions({ ...sortOptions, order: value as SortOrder })
  }

  const handleSortDirectionChange = (value: string) => {
    setSortOptions({ ...sortOptions, direction: value as SortDirection })
  }

  return (
    <EmptyContextMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon">
              <SortDesc className="h-4 w-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuRadioGroup
            value={sortOptions.order}
            onValueChange={handleSortOrderChange}
          >
            <DropdownMenuRadioItem
              value={SORT_ORDERS.Alphabetical}
              className="whitespace-nowrap"
            >
              {sortOptions.direction === SORT_DIRECTIONS.Ascending ? (
                <ArrowUpAZ className="mr-2 h-4 w-4" />
              ) : (
                <ArrowDownAZ className="mr-2 h-4 w-4" />
              )}
              Alphabetical
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value={SORT_ORDERS.DateCreated}
              className="whitespace-nowrap"
            >
              {sortOptions.direction === SORT_DIRECTIONS.Ascending ? (
                <CalendarArrowUp className="mr-2 h-4 w-4" />
              ) : (
                <CalendarArrowDown className="mr-2 h-4 w-4" />
              )}
              Date Created
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value={SORT_ORDERS.DateModified}
              className="whitespace-nowrap"
            >
              {sortOptions.direction === SORT_DIRECTIONS.Ascending ? (
                <ClockArrowUp className="mr-2 h-4 w-4" />
              ) : (
                <ClockArrowDown className="mr-2 h-4 w-4" />
              )}
              Date Modified
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={sortOptions.direction}
            onValueChange={handleSortDirectionChange}
          >
            <DropdownMenuRadioItem
              value={SORT_DIRECTIONS.Ascending}
              className="whitespace-nowrap"
            >
              <SortAsc className="mr-2 h-4 w-4" />
              Ascending
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value={SORT_DIRECTIONS.Descending}
              className="whitespace-nowrap"
            >
              <SortDesc className="mr-2 h-4 w-4" />
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </EmptyContextMenu>
  )
}
