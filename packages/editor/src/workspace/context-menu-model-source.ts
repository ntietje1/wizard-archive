import { createContext, createElement, useContext } from 'react'
import type { ContextMenuHostRef } from '../context-menu/components/host'
import type { ContextMenuSurfaceModel } from '../context-menu/components/surface'
import type { AnyItem } from './items'
import type { ReactElement, ReactNode, Ref } from 'react'
import type { ViewContext, WorkspaceMenuContext } from './menu-context'

export interface WorkspaceContextMenuModel {
  surfaceModel: ContextMenuSurfaceModel
}

export interface WorkspaceContextMenuModelOptions {
  contextOverrides?: Partial<WorkspaceMenuContext>
  item?: AnyItem
  onDialogClose?: () => void
  onDialogOpen?: () => void
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
}

interface WorkspaceContextMenuModelSourceProps {
  children: (model: WorkspaceContextMenuModel) => ReactNode
  options: WorkspaceContextMenuModelOptions
}

export type WorkspaceContextMenuModelSource = (
  props: WorkspaceContextMenuModelSourceProps,
) => ReactElement

const WorkspaceContextMenuModelSourceContext =
  createContext<WorkspaceContextMenuModelSource | null>(null)

export function WorkspaceContextMenuModelSourceProvider({
  children,
  source,
}: {
  children: ReactNode
  source: WorkspaceContextMenuModelSource
}) {
  return createElement(WorkspaceContextMenuModelSourceContext.Provider, { value: source }, children)
}

export function useWorkspaceContextMenuModelSource() {
  const source = useContext(WorkspaceContextMenuModelSourceContext)
  if (!source) {
    throw new Error(
      'useWorkspaceContextMenuModelSource must be used within WorkspaceContextMenuModelSourceProvider',
    )
  }
  return source
}
