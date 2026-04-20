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
      try {
        if (environment.toolState.getActiveTool() !== 'sticky') {
          return
        }

        const placement = createCanvasNodePlacement('sticky', {
          position: environment.viewport.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        })
        environment.document.createNode(placement.node)
        if (placement.node.selected) {
          environment.selection.replaceNodes([placement.node.id])
        }
        if (placement.startEditing) {
          environment.editSession.setPendingEditNodeId(placement.node.id)
        }
      } catch (error) {
        console.error('Sticky tool placement failed', error)
        throw error
      } finally {
        environment.toolState.setActiveTool('select')
      }
    },
  }),
}
