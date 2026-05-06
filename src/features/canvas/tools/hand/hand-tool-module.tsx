import { Hand } from 'lucide-react'
import type { CanvasToolSpec } from '../canvas-tool-types'

export const handToolSpec: CanvasToolSpec<'hand'> = {
  id: 'hand',
  label: 'Panning',
  group: 'selection',
  icon: <Hand className="h-4 w-4" />,
  cursor: 'grab',
  createHandlers: () => ({}),
}
