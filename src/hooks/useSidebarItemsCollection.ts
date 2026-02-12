import { createContext, useContext } from 'react'
import type { CreateItemArgs } from './useSidebarItemMutations'
import type { Collection } from '@tanstack/db'
import type { QueryCollectionUtils } from '@tanstack/query-db-collection'
import type { AnySidebarItem } from 'convex/sidebarItems/types'

export function useSidebarItemsCollection(): SidebarItemsCollection | null {
  return useContext(SidebarItemsCollectionContext)
}

export function usePendingCreateArgs(): React.RefObject<
  Map<string, CreateItemArgs>
> {
  return useContext(PendingCreateArgsContext)
}

export function usePendingItemName() {
  return useContext(PendingItemNameContext)
}
export type SidebarItemsCollection = Collection<
  AnySidebarItem,
  string,
  QueryCollectionUtils<AnySidebarItem, string, AnySidebarItem>
>

export const SidebarItemsCollectionContext =
  createContext<SidebarItemsCollection | null>(null)

export const PendingCreateArgsContext = createContext<
  React.RefObject<Map<string, CreateItemArgs>>
>(null!)

export const PendingItemNameContext = createContext<{
  pendingItemName: string
  setPendingItemName: (name: string) => void
}>(null!)
