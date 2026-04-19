import { MousePointer2 } from 'lucide-react'
import { hitTestCanvasNode } from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
import { getNextSelectedNodeIds, isSelectionToggleModifier } from '../../utils/canvas-selection-utils'
import { SelectAwarenessLayer } from './select-tool-awareness-layer'

export const selectToolModule: CanvasToolModule<'select'> = {
  id: 'select',
  label: 'Pointer',
  group: 'selection',
  icon: <MousePointer2 className="h-4 w-4" />,
  awareness: {
    Layer: SelectAwarenessLayer,
  },
  create: (environment) => {
    const applySelectionFromClick = (event: React.MouseEvent, targetId: string | null) => {
      const nextIds = getNextSelectedNodeIds({
        selectedNodeIds: environment.selection.getSelectedNodeIds(),
        targetId,
        toggle: isSelectionToggleModifier(event),
      })

      // Defer until after React Flow finishes its internal click handling so our
      // selection state becomes the single source of truth for plain and modifier clicks.
      queueMicrotask(() => {
        environment.selection.setNodeSelection(nextIds)
      })
    }

    return {
      onNodeClick: (event, node) => {
        applySelectionFromClick(event, node.id)
      },
      onPaneClick: (event) => {
        applySelectionFromClick(
          event,
          hitTestCanvasNode(
            {
              getMeasuredNodes: environment.document.getMeasuredNodes,
              getZoom: environment.viewport.getZoom,
              screenToFlowPosition: environment.viewport.screenToFlowPosition,
            },
            event,
          ),
        )
      },
    }
  },
}
