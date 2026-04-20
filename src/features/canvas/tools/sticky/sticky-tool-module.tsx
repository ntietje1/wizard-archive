import { StickyNote } from 'lucide-react'
import { createCanvasNodePlacement } from '../../nodes/canvas-node-registry'
import type { CanvasToolModule } from '../canvas-tool-types'

export const stickyToolModule: CanvasToolModule<'sticky'> = {
  id: 'sticky',
  label: 'Post-it',
  group: 'creation',
  icon: <StickyNote className="h-4 w-4" />,
  cursor: 'copy',
  create: (services) => ({
    onPaneClick: (event) => {
      if (services.toolState.getActiveTool() !== 'sticky') {
        return
      }

      try {
        const placement = createCanvasNodePlacement('sticky', {
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
      } catch (error) {
        console.error('Sticky tool placement failed', error)
      } finally {
        services.toolState.setActiveTool('select')
      }
    },
  }),
}
