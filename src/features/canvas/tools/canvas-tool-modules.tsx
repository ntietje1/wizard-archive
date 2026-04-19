import { drawToolModule } from './draw/draw-tool-module'
import { eraseToolModule } from './erase/erase-tool-module'
import { handToolModule } from './hand/hand-tool-module'
import { lassoToolModule } from './lasso/lasso-tool-module'
import { rectangleToolModule } from './rectangle/rectangle-tool-module'
import { selectToolModule } from './select/select-tool-module'
import { stickyToolModule } from './sticky/sticky-tool-module'
import { textToolModule } from './text/text-tool-module'
import type { AnyCanvasToolModule, CanvasToolId } from './canvas-tool-types'

export const canvasToolModules = [
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

export function getCanvasToolModule(toolId: CanvasToolId): AnyCanvasToolModule | undefined {
  return canvasToolModuleMap[toolId]
}
