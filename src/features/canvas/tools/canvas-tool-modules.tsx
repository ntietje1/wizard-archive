import { drawToolSpec } from './draw/draw-tool-module'
import { edgeToolSpec } from './edge/edge-tool-module'
import { eraseToolSpec } from './erase/erase-tool-module'
import { handToolSpec } from './hand/hand-tool-module'
import { lassoToolSpec } from './lasso/lasso-tool-module'
import { selectToolSpec } from './select/select-tool-module'
import { textToolSpec } from './text/text-tool-module'
import type {
  AnyCanvasToolSpec,
  CanvasAwarenessCapability,
  CanvasLocalOverlayCapability,
  CanvasToolId,
} from './canvas-tool-types'

export const canvasToolSpecs = {
  select: selectToolSpec,
  hand: handToolSpec,
  lasso: lassoToolSpec,
  draw: drawToolSpec,
  erase: eraseToolSpec,
  text: textToolSpec,
  edge: edgeToolSpec,
} as const satisfies Record<CanvasToolId, AnyCanvasToolSpec>

const orderedCanvasToolSpecs = [
  selectToolSpec,
  handToolSpec,
  lassoToolSpec,
  drawToolSpec,
  eraseToolSpec,
  textToolSpec,
  edgeToolSpec,
] as const

export type CanvasToolbarTool = Pick<AnyCanvasToolSpec, 'id' | 'label' | 'group' | 'icon'> & {
  shortcut: number
}
type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>
type CanvasLocalOverlayLayer = NonNullable<CanvasLocalOverlayCapability['Layer']>

export const canvasToolbarTools: ReadonlyArray<CanvasToolbarTool> = orderedCanvasToolSpecs.map(
  (spec, index) => ({
    id: spec.id,
    label: spec.label,
    group: spec.group,
    icon: spec.icon,
    shortcut: index + 1,
  }),
)

export const canvasToolAwarenessLayers = orderedCanvasToolSpecs.flatMap((spec) =>
  spec.awareness?.Layer ? [{ key: spec.id as CanvasToolId, Layer: spec.awareness.Layer }] : [],
) satisfies ReadonlyArray<{ key: CanvasToolId; Layer: CanvasAwarenessLayer }>

export const canvasToolLocalOverlayLayers = orderedCanvasToolSpecs.flatMap((spec) =>
  spec.localOverlay?.Layer
    ? [{ key: spec.id as CanvasToolId, Layer: spec.localOverlay.Layer }]
    : [],
) satisfies ReadonlyArray<{ key: CanvasToolId; Layer: CanvasLocalOverlayLayer }>
