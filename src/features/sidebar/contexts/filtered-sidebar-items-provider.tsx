import { createElement } from 'react'
import { FilteredSidebarItemsContext } from '~/features/sidebar/contexts/filtered-sidebar-items-context'
import type { SidebarItemsValue } from './sidebar-items-context'

export function SidebarItemsPassthroughProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SidebarItemsValue
}) {
  return createElement(FilteredSidebarItemsContext.Provider, { value }, children)
}
