import { SORT_DIRECTIONS, SORT_ORDERS } from '../../../items-persistence-contract'
import type { SortDirection, SortOrder } from '../../../items-persistence-contract'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  ClockArrowDown,
  ClockArrowUp,
  SortAsc,
  SortDesc,
} from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import { EmptyContextMenu } from '../../../../context-menu/components/empty'
import { TooltipButton } from '@wizard-archive/ui/components/tooltip-button'
import { useSidebarWorkspaceState } from '../../workspace-state'

const SORT_ORDER_ICONS = {
  [SORT_ORDERS.Alphabetical]: {
    [SORT_DIRECTIONS.Ascending]: ArrowUpAZ,
    [SORT_DIRECTIONS.Descending]: ArrowDownAZ,
  },
  [SORT_ORDERS.DateCreated]: {
    [SORT_DIRECTIONS.Ascending]: CalendarArrowUp,
    [SORT_DIRECTIONS.Descending]: CalendarArrowDown,
  },
  [SORT_ORDERS.DateModified]: {
    [SORT_DIRECTIONS.Ascending]: ClockArrowUp,
    [SORT_DIRECTIONS.Descending]: ClockArrowDown,
  },
} satisfies Record<SortOrder, Record<SortDirection, typeof ArrowUpAZ>>

const SORT_ORDER_LABELS = {
  [SORT_ORDERS.Alphabetical]: 'Alphabetical',
  [SORT_ORDERS.DateCreated]: 'Date Created',
  [SORT_ORDERS.DateModified]: 'Date Modified',
} satisfies Record<SortOrder, string>

const SORT_ORDER_OPTIONS: ReadonlyArray<SortOrder> = [
  SORT_ORDERS.Alphabetical,
  SORT_ORDERS.DateCreated,
  SORT_ORDERS.DateModified,
]

export function SortMenu() {
  const {
    sort: { options: sortOptions, setOptions: setSortOptions },
  } = useSidebarWorkspaceState()

  const handleSortOrderChange = (value: string) => {
    setSortOptions({ ...sortOptions, order: value as SortOrder })
  }

  const handleSortDirectionChange = (value: string) => {
    setSortOptions({ ...sortOptions, direction: value as SortDirection })
  }

  const SortDirectionIcon = sortOptions.direction === SORT_DIRECTIONS.Ascending ? SortAsc : SortDesc

  return (
    <TooltipButton tooltip="Change sort order" side="bottom">
      <EmptyContextMenu>
        <span className="inline-flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton
              render={
                <Button variant="ghost" size="icon" aria-label="Sort options">
                  <SortDirectionIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuRadioGroup
                value={sortOptions.order}
                onValueChange={handleSortOrderChange}
              >
                {SORT_ORDER_OPTIONS.map((order) => {
                  const Icon = SORT_ORDER_ICONS[order][sortOptions.direction]
                  return (
                    <DropdownMenuRadioItem key={order} value={order} className="whitespace-nowrap">
                      <Icon className="mr-2 size-4" />
                      {SORT_ORDER_LABELS[order]}
                    </DropdownMenuRadioItem>
                  )
                })}
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
                  <SortAsc className="mr-2 size-4" />
                  Ascending
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value={SORT_DIRECTIONS.Descending}
                  className="whitespace-nowrap"
                >
                  <SortDesc className="mr-2 size-4" />
                  Descending
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </EmptyContextMenu>
    </TooltipButton>
  )
}
