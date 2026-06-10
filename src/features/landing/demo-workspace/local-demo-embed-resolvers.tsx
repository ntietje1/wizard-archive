import type { INITIAL_DEMO_WORKSPACE } from './demo-workspace-model'
import { createDemoWorkspaceProjection, demoCanvasForItem } from './demo-workspace-model'
import type { Id } from 'convex/_generated/dataModel'
import type {
  EmbeddedCanvasState,
  EmbeddedCanvasStateResolver,
} from '~/features/embeds/context/embedded-canvas-state-resolution'
import type {
  EmbedSidebarItemResolver,
  EmbedSidebarItemState,
} from '~/features/embeds/context/embed-sidebar-item-resolution'

type DemoWorkspaceState = typeof INITIAL_DEMO_WORKSPACE

export function createDemoEmbeddedCanvasStateResolver(
  workspace: DemoWorkspaceState,
): EmbeddedCanvasStateResolver {
  return function DemoEmbeddedCanvasStateResolver({ canvasId, children }) {
    const canvas = demoCanvasForItem(workspace, String(canvasId))
    const state: EmbeddedCanvasState = {
      nodes: canvas.nodes,
      edges: canvas.edges,
      isLoading: false,
      isError: false,
    }

    return <>{children(state)}</>
  }
}

export function createDemoSidebarItemEmbedResolver(
  workspace: DemoWorkspaceState,
): EmbedSidebarItemResolver {
  return function DemoSidebarItemEmbedResolver({ target, children }) {
    if (target.kind !== 'sidebarItem') {
      return <>{children(undefined)}</>
    }

    const sidebarItemId = String(target.sidebarItemId) as Id<'sidebarItems'>
    const item = createDemoWorkspaceProjection(workspace).itemsById.get(sidebarItemId)
    const itemState: EmbedSidebarItemState = item
      ? { status: 'available', label: item.name, item }
      : {
          status: 'not_found',
          label: 'Embedded item',
          message: "This item doesn't exist.",
        }

    return <>{children(itemState)}</>
  }
}
