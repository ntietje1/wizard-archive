import {
  canvasNodeModules,
  getCanvasNodeModule,
  getCanvasNodeModuleByType,
} from './canvas-node-modules'
import type {
  AnyCanvasNodeModule,
  CanvasNodeCreateArgs,
  CanvasNodeData,
  CanvasNodeMinimapProps,
  CanvasNodePreviewOptions,
  CanvasNodeType,
} from './canvas-node-module-types'
import type { Node } from '@xyflow/react'
import type { CanvasAwarenessCapability, CanvasDocumentWriter } from '../tools/canvas-tool-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import { buildCanvasNodeTypes } from './canvas-node-module-types'

type CanvasAwarenessLayer = NonNullable<CanvasAwarenessCapability['Layer']>

let cachedCanvasNodeTypes: ReturnType<typeof buildCanvasNodeTypes> | null = null
let cachedCanvasNodeAwarenessLayers: ReadonlyArray<{
  key: AnyCanvasNodeModule['type']
  Layer: CanvasAwarenessLayer
}> | null = null

export function getCanvasNodeTypes() {
  cachedCanvasNodeTypes ??= buildCanvasNodeTypes(canvasNodeModules)
  return cachedCanvasNodeTypes
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
  cachedCanvasNodeAwarenessLayers ??= canvasNodeModules.flatMap((module) =>
    module.awareness?.Layer ? [{ key: module.type, Layer: module.awareness.Layer }] : [],
  )

  return cachedCanvasNodeAwarenessLayers
}

export function getCanvasNodeContextMenuContributors(type: string | undefined) {
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
