import type { AnySidebarItemWithContent } from './model-types'

export type SidebarItemAvailabilityState =
  | {
      status: 'loading'
      label: string
      item?: undefined
      message?: undefined
    }
  | {
      status: 'available'
      label: string
      item: AnySidebarItemWithContent
      message?: undefined
    }
  | {
      status: 'trashed' | 'not_shared' | 'not_found' | 'not_found_or_not_shared' | 'error'
      label: string
      item?: undefined
      message: string
    }
