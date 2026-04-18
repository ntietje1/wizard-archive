import { StickyNote } from 'lucide-react'
import { createStickyNode } from '../utils/canvas-node-factories'
import type { CanvasToolModule } from './canvas-tool-types'

export const stickyToolModule: CanvasToolModule = {
  id: 'sticky',
  label: 'Post-it',
  group: 'creation',
  icon: <StickyNote className="h-4 w-4" />,
  cursor: 'copy',
  oneShot: true,
  showsStyleControls: false,
  create: (runtime) => ({
    onPaneClick: (event) => {
      const node = createStickyNode(
        runtime.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      )
      runtime.document.createNode(node)
      runtime.editSession.setPendingEditNodeId(node.id)
      runtime.completeActiveToolAction()
    },
  }),
}
