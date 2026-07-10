import { Workflow } from 'lucide-react'
import { lineStrokeSizeCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasStrokeSizeProperty } from '../../properties/canvas-property-types'
import { clampCanvasEdgeStrokeWidth } from '../../edges/shared/canvas-edge-style'
import { bindCanvasToolLinePaintProperty } from '../shared/tool-paint-properties'
import type { CanvasToolSpec } from '../canvas-tool-types'

export const edgeToolSpec: CanvasToolSpec<'edge'> = {
  id: 'edge',
  label: 'Edges',
  group: 'creation',
  icon: <Workflow className="h-4 w-4" />,
  cursor: 'crosshair',
  properties: (context) => ({
    bindings: [
      bindCanvasToolLinePaintProperty(context),
      bindCanvasStrokeSizeProperty(
        lineStrokeSizeCanvasProperty,
        () => clampCanvasEdgeStrokeWidth(context.toolState.getSettings().strokeSize),
        (size) => context.toolState.setStrokeSize(clampCanvasEdgeStrokeWidth(size)),
      ),
    ],
  }),
  createHandlers: () => ({}),
}
