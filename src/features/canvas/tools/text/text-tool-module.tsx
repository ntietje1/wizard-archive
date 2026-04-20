import { Type } from 'lucide-react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-registry'
import type { CanvasToolModule } from '../canvas-tool-types'

export const textToolModule: CanvasToolModule<'text'> = {
  id: 'text',
  label: 'Text',
  group: 'creation',
  icon: <Type className="h-4 w-4" />,
  cursor: 'copy',
  create: (services) => ({
    onPaneClick: (event) => {
      try {
        const placement = createCanvasNodePlacement('text', {
          position: services.viewport.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        })
        services.document.createNode(placement.node)
        if (placement.node.selected) {
          services.selection.replaceNodes([placement.node.id])
        }
        if (placement.startEditing) {
          services.editSession.setPendingEditNodeId(placement.node.id)
        }
      } finally {
        services.toolState.setActiveTool('select')
      }
    },
  }),
}
