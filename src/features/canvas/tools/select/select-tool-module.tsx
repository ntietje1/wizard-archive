import { MousePointer2 } from 'lucide-react'
import { hitTestCanvasNode } from '../../nodes/canvas-node-selection-queries'
import type { CanvasToolModule } from '../canvas-tool-types'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import { SelectAwarenessLayer } from './select-tool-awareness-layer'
import { clearSelectToolLocalOverlay } from './select-tool-local-overlay'
import { SelectToolLocalOverlayLayer } from './select-tool-local-overlay-layer'

export const selectToolModule: CanvasToolModule<'select'> = {
  id: 'select',
  label: 'Pointer',
  group: 'selection',
  icon: <MousePointer2 className="h-4 w-4" />,
  awareness: {
    Layer: SelectAwarenessLayer,
  },
  localOverlay: {
    Layer: SelectToolLocalOverlayLayer,
    clear: clearSelectToolLocalOverlay,
  },
  create: (services) => ({
    onNodeClick: (event, node) => {
      services.selection.toggleNodeFromTarget(node.id, isPrimarySelectionModifier(event))
    },
    onEdgeClick: (event, edge) => {
      services.selection.toggleEdgeFromTarget(edge.id, isPrimarySelectionModifier(event))
    },
    onPaneClick: (event) => {
      services.selection.toggleNodeFromTarget(
        hitTestCanvasNode(
          {
            getMeasuredNodes: services.query.getMeasuredNodes,
            getZoom: services.viewport.getZoom,
            screenToFlowPosition: services.viewport.screenToFlowPosition,
          },
          event,
        ),
        isPrimarySelectionModifier(event),
      )
    },
  }),
}
