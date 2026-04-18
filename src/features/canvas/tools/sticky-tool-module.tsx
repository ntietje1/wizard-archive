import { StickyNote } from 'lucide-react'
import { createStickyNode } from '../utils/canvas-node-factories'
import type { CanvasToolModule } from './canvas-tool-types'

export const stickyToolModule: CanvasToolModule<'sticky'> = {
  id: 'sticky',
  label: 'Post-it',
  group: 'creation',
  icon: <StickyNote className="h-4 w-4" />,
  cursor: 'copy',
  oneShot: true,
  showsStyleControls: false,
  create: (runtime) => ({
    onPaneClick: (event) => {
      const placement = createStickyNode(
        runtime.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      )
      runtime.createNode(placement.node)
      if (placement.startEditing) {
        runtime.setPendingEditNodeId(placement.node.id)
      }
      runtime.completeActiveToolAction()
    },
  }),
}
