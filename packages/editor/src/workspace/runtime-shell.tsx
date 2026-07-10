import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { WorkspaceRuntimeGraph } from './runtime-graph'
import { getWorkspaceNavigationCurrentResourceId } from './runtime'
import type { WorkspaceViewStateStores } from './runtime-host'
import { useWorkspaceRuntime } from './runtime-context'
import { EmbeddedCanvasStateProvider } from '../canvas/embedded-canvas-state-context'
import { ResourceContentSourceProvider } from '../filesystem/resource-content-context'
import type { RightSidebarSource } from './right-sidebar/source'
import type { WorkspaceRightSidebarControls } from './right-sidebar/controls'

interface WorkspaceRuntimeShellProps {
  ariaLabel?: string
  rightSidebar?: {
    source: RightSidebarSource
    state: WorkspaceRightSidebarControls
  }
  sidebar: ReactNode
  viewStateStores: WorkspaceViewStateStores
}

export function WorkspaceRuntimeShell({
  ariaLabel = 'Editor workspace',
  rightSidebar,
  sidebar,
  viewStateStores,
}: WorkspaceRuntimeShellProps) {
  const runtime = useWorkspaceRuntime()
  const currentItemId = getWorkspaceNavigationCurrentResourceId(runtime.navigation)
  const previousItemIdRef = useRef(currentItemId)

  useEffect(() => {
    if (!rightSidebar) return
    if (previousItemIdRef.current === currentItemId) return

    previousItemIdRef.current = currentItemId
    rightSidebar.state.close()
  }, [rightSidebar, currentItemId])

  return (
    <section className="flex h-full min-h-0 bg-background text-foreground" aria-label={ariaLabel}>
      <ResourceContentSourceProvider source={runtime.filesystem.resourceContent}>
        <EmbeddedCanvasStateProvider source={runtime.sessions.canvasEmbedded.embeddedCanvas}>
          <div className="relative flex h-full flex-1 min-h-0 min-w-0">
            {sidebar}
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              <WorkspaceRuntimeGraph
                runtime={runtime}
                rightSidebar={rightSidebar}
                viewStateStores={viewStateStores}
              />
            </div>
          </div>
        </EmbeddedCanvasStateProvider>
      </ResourceContentSourceProvider>
    </section>
  )
}
