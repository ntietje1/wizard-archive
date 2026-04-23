import { drawToolModule } from './draw/draw-tool-module'
import { edgeToolModule } from './edge/edge-tool-module'
import { eraseToolModule } from './erase/erase-tool-module'
import { handToolModule } from './hand/hand-tool-module'
import { lassoToolModule } from './lasso/lasso-tool-module'
import { selectToolModule } from './select/select-tool-module'
import { textToolModule } from './text/text-tool-module'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type {
  AnyCanvasToolModule,
  CanvasAwarenessCapability,
  CanvasLocalOverlayCapability,
  CanvasToolId,
  CanvasToolPropertyContext,
  CanvasToolRuntime,
} from './canvas-tool-types'

const canvasToolModules = [
  selectToolModule,
  handToolModule,
  lassoToolModule,
  drawToolModule,
  eraseToolModule,
  textToolModule,
  edgeToolModule,
] as const satisfies ReadonlyArray<AnyCanvasToolModule>

const canvasToolModuleMap: Partial<Record<CanvasToolId, AnyCanvasToolModule>> = Object.fromEntries(
  canvasToolModules.map((module) => [module.id, module] as const),
)

type CanvasToolbarTool = Pick<AnyCanvasToolModule, 'id' | 'label' | 'group' | 'icon'> & {
  shortcut: number
}
type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>
type CanvasLocalOverlayLayer = NonNullable<CanvasLocalOverlayCapability['Layer']>

const canvasToolbarTools = canvasToolModules.map<CanvasToolbarTool>(
  ({ id, label, group, icon }, index) => ({
    id,
    label,
    group,
    icon,
    shortcut: index + 1,
  }),
)

const canvasToolAwarenessLayers = canvasToolModules.flatMap((module) =>
  module.awareness?.Layer ? [{ key: module.id, Layer: module.awareness.Layer }] : [],
)

const canvasToolLocalOverlayLayers = canvasToolModules.flatMap((module) =>
  module.localOverlay?.Layer ? [{ key: module.id, Layer: module.localOverlay.Layer }] : [],
)

function getCanvasToolModule(toolId: CanvasToolId): AnyCanvasToolModule {
  const module = canvasToolModuleMap[toolId]
  if (!module) {
    throw new Error(`Missing canvas tool module for "${toolId}"`)
  }

  return module
}

export function getCanvasToolbarTools(): ReadonlyArray<CanvasToolbarTool> {
  return canvasToolbarTools
}

export function getCanvasToolCursor(toolId: CanvasToolId): string | undefined {
  return getCanvasToolModule(toolId).cursor
}

export function getCanvasToolProperties(
  toolId: CanvasToolId,
  context: CanvasToolPropertyContext,
): CanvasInspectableProperties | null {
  return getCanvasToolModule(toolId).properties?.(context) ?? null
}

export function getCanvasToolAwarenessLayers(): ReadonlyArray<{
  key: CanvasToolId
  Layer: CanvasAwarenessLayer
}> {
  return canvasToolAwarenessLayers
}

export function getCanvasToolLocalOverlayLayers(): ReadonlyArray<{
  key: CanvasToolId
  Layer: CanvasLocalOverlayLayer
}> {
  return canvasToolLocalOverlayLayers
}

export function createCanvasToolHandlers(toolId: CanvasToolId, runtime: CanvasToolRuntime) {
  return getCanvasToolModule(toolId).createHandlers(runtime)
}

export function clearCanvasToolTransientState(
  toolId: CanvasToolId,
  presence?: CanvasToolRuntime['awareness']['presence'],
) {
  const module = getCanvasToolModule(toolId)
  module.localOverlay?.clear()
  if (presence) {
    module.awareness?.clear?.(presence)
  }
}
