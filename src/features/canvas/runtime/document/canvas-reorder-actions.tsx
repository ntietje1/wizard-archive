import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine } from 'lucide-react'
import type { CanvasReorderDirection } from './canvas-reorder'

export const CANVAS_REORDER_SUBMENU_ICON = ArrowUpToLine

export const CANVAS_REORDER_ACTIONS = [
  {
    id: 'send-to-back',
    label: 'Send to back',
    icon: ArrowDownToLine,
    direction: 'sendToBack',
  },
  {
    id: 'send-backward',
    label: 'Send backward',
    icon: ArrowDown,
    direction: 'sendBackward',
  },
  {
    id: 'bring-forward',
    label: 'Bring forward',
    icon: ArrowUp,
    direction: 'bringForward',
  },
  {
    id: 'bring-to-front',
    label: 'Bring to front',
    icon: ArrowUpToLine,
    direction: 'bringToFront',
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  direction: CanvasReorderDirection
}>
