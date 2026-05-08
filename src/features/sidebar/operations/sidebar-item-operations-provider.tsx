import type { ReactNode } from 'react'
import { useItemSurfaceHotkeys } from '~/features/sidebar/hooks/useItemSurfaceHotkeys'
import {
  SidebarItemOperationsContext,
  useSidebarItemOperationsValue,
} from '~/features/sidebar/operations/useSidebarItemOperations'

export function SidebarItemOperationsProvider({ children }: { children: ReactNode }) {
  const value = useSidebarItemOperationsValue()
  useItemSurfaceHotkeys(value)

  return (
    <SidebarItemOperationsContext.Provider value={value}>
      {children}
      {value.dialog}
    </SidebarItemOperationsContext.Provider>
  )
}
