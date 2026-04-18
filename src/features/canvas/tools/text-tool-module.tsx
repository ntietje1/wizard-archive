import { Type } from 'lucide-react'
import { createTextNode } from '../utils/canvas-node-factories'
import type { CanvasToolModule } from './canvas-tool-types'

export const textToolModule: CanvasToolModule = {
  id: 'text',
  label: 'Text',
  group: 'creation',
  icon: <Type className="h-4 w-4" />,
  cursor: 'copy',
  oneShot: true,
  showsStyleControls: false,
  create: (runtime) => ({
    onPaneClick: (event) => {
      try {
        const node = createTextNode(
          runtime.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          }),
        )
        runtime.document.createNode(node)
        runtime.editSession.setPendingEditNodeId(node.id)
      } finally {
        runtime.completeActiveToolAction()
      }
    },
  }),
}
