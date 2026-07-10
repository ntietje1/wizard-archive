import { Type } from 'lucide-react'
import type { CanvasToolSpec } from '../canvas-tool-types'
import { RectCreationLocalOverlayLayer } from '../shared/rect-creation-local-overlay-layer'
import { createRectangularPlacementToolController } from '../shared/create-rectangular-placement-tool'

export const textToolSpec: CanvasToolSpec<'text'> = {
  id: 'text',
  label: 'Text',
  group: 'creation',
  icon: <Type className="h-4 w-4" />,
  cursor: 'crosshair',
  localOverlay: {
    Layer: RectCreationLocalOverlayLayer,
  },
  createHandlers: (services) => createRectangularPlacementToolController('text', services),
}
