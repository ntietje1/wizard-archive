import { embedNodeModule } from './embed/embed-node-module'
import { strokeNodeModule } from './stroke/stroke-node-module'
import { textNodeModule } from './text/text-node-module'
import type {
  AnyCanvasNodeModule,
  CanvasNodeModule,
  CanvasNodeType,
} from './canvas-node-module-types'

export const canvasNodeModules = [
  embedNodeModule,
  strokeNodeModule,
  textNodeModule,
] as const satisfies ReadonlyArray<AnyCanvasNodeModule>

const canvasNodeModuleMap: Partial<Record<CanvasNodeType, AnyCanvasNodeModule>> =
  Object.fromEntries(canvasNodeModules.map((module) => [module.type, module] as const))

function isCanvasNodeType(type: string): type is CanvasNodeType {
  return type in canvasNodeModuleMap
}

export function getCanvasNodeModule(type: CanvasNodeType): CanvasNodeModule {
  const module = canvasNodeModuleMap[type]
  if (!module) {
    throw new Error(`Missing canvas node module for "${type}"`)
  }

  return module
}

export function getCanvasNodeModuleByType(type: string | undefined): CanvasNodeModule | null {
  if (!type || !isCanvasNodeType(type)) {
    return null
  }

  return getCanvasNodeModule(type)
}
