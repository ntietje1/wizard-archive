import { drawToolModule } from './draw/draw-tool-module'
import { eraseToolModule } from './erase/erase-tool-module'
import { handToolModule } from './hand/hand-tool-module'
import { lassoToolModule } from './lasso/lasso-tool-module'
import { rectangleToolModule } from './rectangle/rectangle-tool-module'
import { selectToolModule } from './select/select-tool-module'
import { stickyToolModule } from './sticky/sticky-tool-module'
import { textToolModule } from './text/text-tool-module'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type {
  AnyCanvasToolModule,
  CanvasAwarenessCapability,
  CanvasToolController,
  CanvasToolEnvironment,
  CanvasToolId,
  CanvasToolPropertyContext,
} from './canvas-tool-types'

const canvasToolModules = [
  selectToolModule,
  handToolModule,
  lassoToolModule,
  drawToolModule,
  eraseToolModule,
  textToolModule,
  stickyToolModule,
  rectangleToolModule,
] as const satisfies ReadonlyArray<AnyCanvasToolModule>

const canvasToolModuleMap: Partial<Record<CanvasToolId, AnyCanvasToolModule>> = Object.fromEntries(
  canvasToolModules.map((module) => [module.id, module] as const),
)

type CanvasToolbarTool = Pick<AnyCanvasToolModule, 'id' | 'label' | 'group' | 'icon'>
type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>

const canvasToolbarTools = canvasToolModules.map<CanvasToolbarTool>(
  ({ id, label, group, icon }) => ({ id, label, group, icon }),
)

const canvasToolAwarenessLayers = canvasToolModules.flatMap((module) =>
  module.awareness?.Layer ? [{ key: module.id, Layer: module.awareness.Layer }] : [],
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

export function createCanvasToolController(
  toolId: CanvasToolId,
  environment: CanvasToolEnvironment,
): CanvasToolController {
  return getCanvasToolModule(toolId).create(environment)
}
