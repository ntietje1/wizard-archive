import { MousePointer2 } from 'lucide-react'
import { hitTestStrokeNode } from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'

export const selectToolModule: CanvasToolModule = {
  id: 'select',
  label: 'Pointer',
  group: 'selection',
  icon: <MousePointer2 className="h-4 w-4" />,
  oneShot: false,
  showsStyleControls: false,
  create: (runtime) => ({
    onPaneClick: (event) => {
      const targetId = hitTestStrokeNode(runtime, event)
      if (!targetId) {
        runtime.document.clearSelection()
        return
      }

      const existing = runtime.document
        .getNodes()
        .filter((node) => node.selected)
        .map((node) => node.id)
      const nextIds = event.shiftKey
        ? existing.includes(targetId)
          ? existing.filter((id) => id !== targetId)
          : [...existing, targetId]
        : [targetId]

      // Defer until after React Flow finishes pane-click handling so selection updates
      // do not race its internal deselection pass.
      const selectionToApply = nextIds
      queueMicrotask(() => {
        runtime.document.setNodeSelection(selectionToApply)
      })
    },
  }),
}
