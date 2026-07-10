import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { AnyItem } from './items'
import { WorkspaceRuntimeContextMenuSourceProvider } from './context-menu/runtime-source-provider'
import { getWorkspaceNavigationCurrentResourceId } from './runtime'
import type { WorkspaceNavigation, WorkspaceRuntime } from './runtime'
import type { ResourceCatalog } from '../filesystem/catalog'
import { SidebarWorkspaceStateProvider } from './sidebar/workspace-state'
import type { SidebarWorkspaceState } from './sidebar/workspace-state'
import { createSidebarFileSystemSelection } from './sidebar/file-system-selection'
import { revealSidebarItemParents } from './sidebar/reveal'
import { WorkspaceSidebarRevealProvider } from './sidebar/reveal-provider'

export function WorkspaceRuntimeSidebarProviders({
  children,
  runtime,
  sidebarWorkspaceState,
}: {
  children: ReactNode | ((runtime: WorkspaceRuntime) => ReactNode)
  runtime: WorkspaceRuntime
  sidebarWorkspaceState: SidebarWorkspaceState
}) {
  return (
    <WorkspaceRuntimeSidebarProvidersWithState
      runtime={runtime}
      sidebarWorkspaceState={sidebarWorkspaceState}
    >
      {children}
    </WorkspaceRuntimeSidebarProvidersWithState>
  )
}

function WorkspaceRuntimeSidebarProvidersWithState({
  children,
  runtime,
  sidebarWorkspaceState,
}: {
  children: ReactNode | ((runtime: WorkspaceRuntime) => ReactNode)
  runtime: WorkspaceRuntime
  sidebarWorkspaceState: SidebarWorkspaceState
}) {
  const sidebarSelection = createSidebarFileSystemSelection(sidebarWorkspaceState)
  const showItemInSidebar = (itemId: AnyItem['id']) =>
    revealSidebarItemParents({
      catalog: runtime.filesystem.catalog,
      itemId,
      uiCommands: sidebarWorkspaceState.uiCommands,
    })
  useRevealCurrentRuntimeItemParents(
    {
      catalog: runtime.filesystem.catalog,
      navigation: runtime.navigation,
    },
    sidebarWorkspaceState,
  )

  return (
    <SidebarWorkspaceStateProvider value={sidebarWorkspaceState}>
      <WorkspaceSidebarRevealProvider showItemInSidebar={showItemInSidebar}>
        <WorkspaceRuntimeContextMenuSourceProvider runtime={runtime} selection={sidebarSelection}>
          {typeof children === 'function' ? children(runtime) : children}
        </WorkspaceRuntimeContextMenuSourceProvider>
      </WorkspaceSidebarRevealProvider>
    </SidebarWorkspaceStateProvider>
  )
}

function useRevealCurrentRuntimeItemParents(
  source: {
    catalog: ResourceCatalog
    navigation: Pick<WorkspaceNavigation, 'current'>
  },
  sidebarWorkspaceState: SidebarWorkspaceState,
) {
  const currentItemId = getWorkspaceNavigationCurrentResourceId(source.navigation)
  const lastRevealedItemIdRef = useRef<AnyItem['id'] | null>(null)

  useEffect(() => {
    if (!currentItemId) {
      lastRevealedItemIdRef.current = null
      return
    }
    if (lastRevealedItemIdRef.current === currentItemId) return
    lastRevealedItemIdRef.current = currentItemId
    revealSidebarItemParents({
      catalog: source.catalog,
      itemId: currentItemId,
      uiCommands: sidebarWorkspaceState.uiCommands,
    })
  }, [currentItemId, source.catalog, sidebarWorkspaceState.uiCommands])
}
