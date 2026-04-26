import { Lasso } from 'lucide-react'
import type { CanvasToolSpec } from '../canvas-tool-types'
import { LassoAwarenessLayer } from './lasso-tool-awareness-layer'
import { setLassoToolAwareness } from './lasso-tool-awareness'
import { clearLassoToolLocalOverlay } from './lasso-tool-local-overlay'
import { LassoToolLocalOverlayLayer } from './lasso-tool-local-overlay-layer'

export const lassoToolSpec: CanvasToolSpec<'lasso'> = {
  id: 'lasso',
  label: 'Lasso select',
  group: 'selection',
  icon: <Lasso className="h-4 w-4" />,
  cursor: 'crosshair',
  awareness: {
    Layer: LassoAwarenessLayer,
    clear: (presence) => setLassoToolAwareness(presence, null),
  },
  localOverlay: {
    Layer: LassoToolLocalOverlayLayer,
    clear: clearLassoToolLocalOverlay,
  },
  createHandlers: () => ({}),
}
