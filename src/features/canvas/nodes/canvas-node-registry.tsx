import { embedNodeModule } from './embed/embed-node-module'
import type {
  AnyCanvasNodeModule,
  CanvasNodeCreateArgs,
  CanvasNodeData,
  CanvasNodeMinimapProps,
  CanvasNodeModule,
  CanvasNodePreviewOptions,
  CanvasNodeSelectionContext,
  CanvasNodeType,
} from './canvas-node-module-types'
import type { Node } from '@xyflow/react'
import type { CanvasAwarenessCapability, CanvasDocumentWriter } from '../tools/canvas-tool-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'
import { rectangleNodeModule } from './rectangle/rectangle-node-module'
import { strokeNodeModule } from './stroke/stroke-node-module'
import { textNodeModule } from './text/text-node-module'
import { stickyNodeModule } from './sticky/sticky-node-module'

const canvasNodeModules = [
  embedNodeModule,
  rectangleNodeModule,
  stickyNodeModule,
  strokeNodeModule,
  textNodeModule,
] as const satisfies ReadonlyArray<AnyCanvasNodeModule>

const canvasNodeModuleMap: Partial<Record<CanvasNodeType, AnyCanvasNodeModule>> =
  Object.fromEntries(canvasNodeModules.map((module) => [module.type, module] as const))

type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>

const canvasNodeAwarenessLayers = canvasNodeModules.flatMap((module) =>
  module.awareness?.Layer ? [{ key: module.type, Layer: module.awareness.Layer }] : [],
)

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

export function renderCanvasNodeMinimap(
  type: string | undefined,
  props: CanvasNodeMinimapProps,
): React.ReactNode | null {
  return getCanvasNodeModuleByType(type)?.renderMinimap?.(props) ?? null
}

export function getCanvasNodeProperties(
  node: Node,
  updateNodeData: CanvasDocumentWriter['updateNodeData'],
): CanvasInspectableProperties | null {
  return getCanvasNodeModuleByType(node.type)?.properties?.({ node, updateNodeData }) ?? null
}

export function getCanvasNodeAwarenessLayers(): ReadonlyArray<{
  key: CanvasNodeType
  Layer: CanvasAwarenessLayer
}> {
  return canvasNodeAwarenessLayers
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
