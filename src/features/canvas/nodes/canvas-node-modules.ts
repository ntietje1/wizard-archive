import { embedNodeModule } from './embed/embed-node-module'
import { strokeNodeModule } from './stroke/stroke-node-module'
import { textNodeModule } from './text/text-node-module'
import type {
  AnyCanvasNodeModule,
  CanvasNodeCreateArgs,
  CanvasNodeType,
  CanvasNodeMinimapProps,
  CanvasNodeModule,
} from './canvas-node-module-types'
import type { Node } from '@xyflow/react'
import type { ReactNode } from 'react'
import type { CanvasAwarenessCapability, CanvasDocumentWriter } from '../tools/canvas-tool-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { CanvasContextMenuContributor } from '../runtime/context-menu/canvas-context-menu-types'
import { buildCanvasNodeTypes } from './canvas-node-module-types'

const canvasNodeModules = [
  embedNodeModule,
  strokeNodeModule,
  textNodeModule,
] as const satisfies ReadonlyArray<AnyCanvasNodeModule>

const canvasNodeModuleMap: Partial<Record<CanvasNodeType, AnyCanvasNodeModule>> =
  Object.fromEntries(canvasNodeModules.map((module) => [module.type, module] as const))
type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>

let cachedCanvasNodeTypes: ReturnType<typeof buildCanvasNodeTypes> | null = null
let cachedCanvasNodeAwarenessLayers: ReadonlyArray<{
  key: CanvasNodeType
  Layer: CanvasAwarenessLayer
}> | null = null

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

export function getCanvasNodeTypes() {
  cachedCanvasNodeTypes ??= buildCanvasNodeTypes(canvasNodeModules)
  return cachedCanvasNodeTypes
}

export function renderCanvasNodeMinimap(
  type: string | undefined,
  props: CanvasNodeMinimapProps,
): ReactNode | null {
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
  cachedCanvasNodeAwarenessLayers ??= canvasNodeModules.flatMap((module) =>
    module.awareness?.Layer ? [{ key: module.type, Layer: module.awareness.Layer }] : [],
  )

  return cachedCanvasNodeAwarenessLayers
}

export function getCanvasNodeContextMenuContributors(
  type: string | undefined,
): ReadonlyArray<CanvasContextMenuContributor> {
  return getCanvasNodeModuleByType(type)?.contextMenu?.contributors ?? []
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
