import { Type } from 'lucide-react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-registry'
import type { CanvasToolModule } from '../canvas-tool-types'

export const textToolModule: CanvasToolModule<'text'> = {
  id: 'text',
  label: 'Text',
  group: 'creation',
  icon: <Type className="h-4 w-4" />,
  cursor: 'copy',
  create: (environment) => ({
    onPaneClick: (event) => {
      try {
        const placement = createCanvasNodePlacement('text', {
          position: environment.viewport.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        })
        environment.document.createNode(placement.node)
        if (placement.node.selected) {
          environment.selection.replace([placement.node.id])
        }
        if (placement.startEditing) {
          environment.editSession.setPendingEditNodeId(placement.node.id)
        }
      } finally {
        environment.toolState.setActiveTool('select')
      }
    },
  }),
}
