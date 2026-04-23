import { Workflow } from 'lucide-react'
import {
  linePaintCanvasProperty,
  strokeSizeCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import type { CanvasToolModule } from '../canvas-tool-types'

export const edgeToolModule: CanvasToolModule<'edge'> = {
  id: 'edge',
  label: 'Edges',
  group: 'creation',
  icon: <Workflow className="h-4 w-4" />,
  cursor: 'crosshair',
  properties: (context) => ({
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => context.toolState.getSettings().strokeColor,
        setColor: context.toolState.setStrokeColor,
        getOpacity: () => context.toolState.getSettings().strokeOpacity,
        setOpacity: context.toolState.setStrokeOpacity,
      }),
      bindCanvasStrokeSizeProperty(
        strokeSizeCanvasProperty,
        () => context.toolState.getSettings().strokeSize,
        context.toolState.setStrokeSize,
      ),
    ],
  }),
  createHandlers: () => ({}),
}
