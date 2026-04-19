import { StickyNote } from 'lucide-react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-registry'
import type { CanvasToolModule } from '../canvas-tool-types'

export const stickyToolModule: CanvasToolModule<'sticky'> = {
  id: 'sticky',
  label: 'Post-it',
  group: 'creation',
  icon: <StickyNote className="h-4 w-4" />,
  cursor: 'copy',
  create: (environment) => ({
    onPaneClick: (event) => {
      const placement = createCanvasNodePlacement('sticky', {
        position: environment.viewport.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      })
      environment.document.createNode(placement.node)
      if (placement.node.selected) {
        environment.selection.setNodeSelection([placement.node.id])
      }
      if (placement.startEditing) {
        environment.editSession.setPendingEditNodeId(placement.node.id)
      }
      environment.toolState.setActiveTool('select')
    },
  }),
}
