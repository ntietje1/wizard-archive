import { Hand } from 'lucide-react'
import type { CanvasToolModule } from '../canvas-tool-types'

export const handToolModule: CanvasToolModule<'hand'> = {
  id: 'hand',
  label: 'Panning',
  group: 'selection',
  icon: <Hand className="h-4 w-4" />,
  cursor: 'grab',
  create: (services) => {
    let gestureActive = false

    return {
      onMoveStart: (event) => {
        if (!event || services.toolState.getActiveTool() !== 'hand') return
        gestureActive = true
      },
      onMoveEnd: () => {
        if (!gestureActive || services.toolState.getActiveTool() !== 'hand') return
        gestureActive = false
      },
    }
  },
}
