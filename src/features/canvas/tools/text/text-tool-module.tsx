import { Type } from 'lucide-react'
import type { CanvasToolModule } from '../canvas-tool-types'
import { clearRectCreationLocalOverlay } from '../shared/rect-creation-local-overlay'
import { RectCreationLocalOverlayLayer } from '../shared/rect-creation-local-overlay-layer'
import { createRectangularPlacementToolController } from '../shared/create-rectangular-placement-tool'

export const textToolModule: CanvasToolModule<'text'> = {
  id: 'text',
  label: 'Text',
  group: 'creation',
  icon: <Type className="h-4 w-4" />,
  cursor: 'crosshair',
  localOverlay: {
    Layer: RectCreationLocalOverlayLayer,
    clear: clearRectCreationLocalOverlay,
  },
  createHandlers: (services) => createRectangularPlacementToolController('text', services),
}
