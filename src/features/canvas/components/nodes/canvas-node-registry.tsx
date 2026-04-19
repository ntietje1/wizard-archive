import { embedNodeModule } from './embed-node-module'
import type {
  AnyCanvasNodeModule,
  CanvasNodeCreateArgs,
  CanvasNodeData,
  CanvasNodeModule,
  CanvasNodePreviewOptions,
  CanvasNodeSelectionContext,
  CanvasNodeType,
} from './canvas-node-module-types'
import { buildCanvasNodeTypes } from './canvas-node-module-types'
import type { Node } from '@xyflow/react'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import { rectangleNodeModule } from './rectangle-node-module'
import { stickyNodeModule } from './sticky-node-module'
import { strokeNodeModule } from './stroke-node-module'
import { textNodeModule } from './text-node-module'

export const canvasNodeModules = [
  embedNodeModule,
  rectangleNodeModule,
  stickyNodeModule,
  strokeNodeModule,
  textNodeModule,
] as const satisfies ReadonlyArray<AnyCanvasNodeModule>

const canvasNodeModuleMap: Partial<Record<CanvasNodeType, AnyCanvasNodeModule>> =
  Object.fromEntries(canvasNodeModules.map((module) => [module.type, module] as const))

export const canvasNodeTypes = buildCanvasNodeTypes(canvasNodeModules)

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
  if (!type || !isCanvasNodeType(type)) return null
  return getCanvasNodeModule(type)
}

export function canEditCanvasNodeStyle(type: string | undefined): boolean {
  return !!getCanvasNodeModuleByType(type)?.properties
}

export function renderCanvasNodePreview(
  type: string | undefined,
  data: CanvasNodeData,
  options?: CanvasNodePreviewOptions,
): React.ReactNode {
  const module = getCanvasNodeModuleByType(type)
  if (!module) return null

  const previewData = module.parseData(data)
  return previewData ? module.renderPreview(previewData, options) : null
}

export function createCanvasNodePlacement(
  type: CanvasNodeType,
  args: CanvasNodeCreateArgs,
): { node: Node; startEditing: boolean } {
  return getCanvasNodeModule(type).create(args)
}

export function createCanvasNode(type: CanvasNodeType, args: CanvasNodeCreateArgs): Node {
  return createCanvasNodePlacement(type, args).node
}

export function findCanvasNodeAtPoint(
  nodes: Array<Node>,
  point: Point2D,
  context: CanvasNodeSelectionContext,
): string | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (getCanvasNodeModuleByType(node.type)?.selection?.point?.(node, point, context)) {
      return node.id
    }
  }

  return null
}

export function getCanvasNodesMatchingRectangle(
  nodes: Array<Node>,
  rect: Bounds,
  context: CanvasNodeSelectionContext,
): Array<string> {
  return nodes
    .filter((node) =>
      getCanvasNodeModuleByType(node.type)?.selection?.rectangle?.(node, rect, context),
    )
    .map((node) => node.id)
}

export function getCanvasNodesMatchingLasso(
  nodes: Array<Node>,
  polygon: Array<Point2D>,
  context: CanvasNodeSelectionContext,
): Array<string> {
  return nodes
    .filter((node) =>
      getCanvasNodeModuleByType(node.type)?.selection?.lasso?.(node, polygon, context),
    )
    .map((node) => node.id)
}
