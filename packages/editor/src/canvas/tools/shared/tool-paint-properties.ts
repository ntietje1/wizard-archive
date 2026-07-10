import { linePaintCanvasProperty } from '../../properties/canvas-property-definitions'
import { bindCanvasPaintProperty } from '../../properties/canvas-property-types'
import type { CanvasToolPropertyContext } from '../canvas-tool-types'

export function bindCanvasToolLinePaintProperty(context: CanvasToolPropertyContext) {
  return bindCanvasPaintProperty(linePaintCanvasProperty, {
    getColor: () => context.toolState.getSettings().strokeColor,
    setColor: context.toolState.setStrokeColor,
    getOpacity: () => context.toolState.getSettings().strokeOpacity,
    setOpacity: context.toolState.setStrokeOpacity,
  })
}
