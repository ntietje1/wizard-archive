import { drawToolModule } from './draw/draw-tool-module'
import { eraseToolModule } from './erase/erase-tool-module'
import { handToolModule } from './hand/hand-tool-module'
import { lassoToolModule } from './lasso/lasso-tool-module'
import { selectToolModule } from './select/select-tool-module'
import { textToolModule } from './text/text-tool-module'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import { assertNever } from '~/shared/utils/utils'
import type {
  AnyCanvasToolModule,
  CanvasAwarenessCapability,
  CanvasDrawToolServices,
  CanvasEraseToolServices,
  CanvasHandToolServices,
  CanvasLassoToolServices,
  CanvasLocalOverlayCapability,
  CanvasSelectToolServices,
  CanvasToolController,
  CanvasToolId,
  CanvasToolPropertyContext,
  CanvasToolServices,
  CanvasTextToolServices,
} from './canvas-tool-types'

const canvasToolModules = [
  selectToolModule,
  handToolModule,
  lassoToolModule,
  drawToolModule,
  eraseToolModule,
  textToolModule,
] as const satisfies ReadonlyArray<AnyCanvasToolModule>

const canvasToolModuleMap: Partial<Record<CanvasToolId, AnyCanvasToolModule>> = Object.fromEntries(
  canvasToolModules.map((module) => [module.id, module] as const),
)

type CanvasToolbarTool = Pick<AnyCanvasToolModule, 'id' | 'label' | 'group' | 'icon'>
type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>
type CanvasLocalOverlayLayer = NonNullable<CanvasLocalOverlayCapability['Layer']>

const canvasToolbarTools = canvasToolModules.map<CanvasToolbarTool>(
  ({ id, label, group, icon }) => ({ id, label, group, icon }),
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

export function createCanvasToolController(
  toolId: CanvasToolId,
  services: CanvasToolServices,
): CanvasToolController {
  switch (toolId) {
    case 'select':
      return selectToolModule.create({
        viewport: services.viewport,
        query: services.query,
        selection: services.selection,
      } satisfies CanvasSelectToolServices)
    case 'hand':
      return handToolModule.create({
        toolState: services.toolState,
      } satisfies CanvasHandToolServices)
    case 'draw':
      return drawToolModule.create({
        viewport: services.viewport,
        commands: services.commands,
        modifiers: services.modifiers,
        toolState: services.toolState,
        awareness: services.awareness,
      } satisfies CanvasDrawToolServices)
    case 'erase':
      return eraseToolModule.create({
        viewport: services.viewport,
        commands: services.commands,
        query: services.query,
      } satisfies CanvasEraseToolServices)
    case 'lasso':
      return lassoToolModule.create({
        viewport: services.viewport,
        query: services.query,
        selection: services.selection,
        interaction: services.interaction,
        awareness: services.awareness,
      } satisfies CanvasLassoToolServices)
    case 'text':
      return textToolModule.create({
        viewport: services.viewport,
        commands: services.commands,
        selection: services.selection,
        editSession: services.editSession,
        toolState: services.toolState,
        modifiers: services.modifiers,
      } satisfies CanvasTextToolServices)
    default:
      return assertNever(toolId)
  }
}

export function clearCanvasToolLocalOverlays() {
  for (const module of canvasToolModules) {
    module.localOverlay?.clear()
  }
}
