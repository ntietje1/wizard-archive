import { Workflow } from 'lucide-react'
import {
  lineStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
} from '../../properties/canvas-property-definitions'
import {
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../../properties/canvas-property-types'
import { clampCanvasEdgeStrokeWidth } from '../../edges/shared/canvas-edge-style'
import type { CanvasToolSpec } from '../canvas-tool-types'

export const edgeToolSpec: CanvasToolSpec<'edge'> = {
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
        lineStrokeSizeCanvasProperty,
        () => clampCanvasEdgeStrokeWidth(context.toolState.getSettings().strokeSize),
        (size) => context.toolState.setStrokeSize(clampCanvasEdgeStrokeWidth(size)),
      ),
    ],
  }),
  createHandlers: () => ({}),
}
