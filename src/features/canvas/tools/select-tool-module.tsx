import { MousePointer2 } from 'lucide-react'
import { hitTestStrokeNode } from './tool-module-utils'
import type { CanvasToolModule } from './canvas-tool-types'
import { getNextSelectedNodeIds, isSelectionToggleModifier } from '../utils/canvas-selection-utils'

export const selectToolModule: CanvasToolModule<'select'> = {
  id: 'select',
  label: 'Pointer',
  group: 'selection',
  icon: <MousePointer2 className="h-4 w-4" />,
  oneShot: false,
  showsStyleControls: false,
  create: (runtime) => {
    const applySelectionFromClick = (event: React.MouseEvent, targetId: string | null) => {
      const nextIds = getNextSelectedNodeIds({
        selectedNodeIds: runtime.getSelectionSnapshot(),
        targetId,
        toggle: isSelectionToggleModifier(event),
      })

      // Defer until after React Flow finishes its internal click handling so our
      // selection state becomes the single source of truth for plain and modifier clicks.
      queueMicrotask(() => {
        runtime.setNodeSelection(nextIds)
      })
    }

    return {
      onNodeClick: (event, node) => {
        applySelectionFromClick(event, node.id)
      },
      onPaneClick: (event) => {
        applySelectionFromClick(event, hitTestStrokeNode(runtime, event))
      },
    }
  },
}
