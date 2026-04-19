import { MousePointer2 } from 'lucide-react'
import { hitTestCanvasNode } from '../shared/tool-module-utils'
import type { CanvasToolModule } from '../canvas-tool-types'
import { isSelectionToggleModifier } from '../../utils/canvas-selection-utils'
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
  create: (environment) => ({
    onNodeClick: (event, node) => {
      environment.selection.toggleFromTarget(node.id, isSelectionToggleModifier(event))
    },
    onPaneClick: (event) => {
      environment.selection.toggleFromTarget(
        hitTestCanvasNode(
          {
            getMeasuredNodes: environment.document.getMeasuredNodes,
            getZoom: environment.viewport.getZoom,
            screenToFlowPosition: environment.viewport.screenToFlowPosition,
          },
          event,
        ),
        isSelectionToggleModifier(event),
      )
    },
  }),
}
