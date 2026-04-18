import { Hand } from 'lucide-react'
import type { CanvasToolModule } from './canvas-tool-types'

export const handToolModule: CanvasToolModule = {
  id: 'hand',
  label: 'Panning',
  group: 'selection',
  icon: <Hand className="h-4 w-4" />,
  cursor: 'grab',
  oneShot: false,
  showsStyleControls: false,
  create: (runtime) => {
    let gestureActive = false

    return {
      onMoveStart: (event) => {
        if (!event || runtime.getActiveTool() !== 'hand') return
        gestureActive = true
      },
      onMoveEnd: () => {
        if (!gestureActive || runtime.getActiveTool() !== 'hand') return
        gestureActive = false
        runtime.completeActiveToolAction()
      },
    }
  },
}
