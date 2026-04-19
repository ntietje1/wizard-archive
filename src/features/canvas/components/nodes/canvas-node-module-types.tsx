import type { Node, NodeProps, NodeTypes, XYPosition } from '@xyflow/react'
import type { ComponentType, ReactNode } from 'react'
import type { CanvasAwarenessCapability, CanvasDocumentWriter } from '../../tools/canvas-tool-types'
import type { CanvasInspectableProperties } from '../../properties/canvas-property-types'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'

export interface CanvasNodePreviewOptions {
  width: number
  height: number
}

export type CanvasNodeData = Record<string, unknown>

export type CanvasNodeType = 'embed' | 'rectangle' | 'sticky' | 'stroke' | 'text'

interface CanvasNodePlacementBehavior {
  anchor: 'center' | 'top-left'
  selectOnCreate: boolean
  startEditingOnCreate: boolean
}

export interface CanvasNodeCreateArgs {
  position: XYPosition
  size?: { width: number; height: number }
  data?: CanvasNodeData
}

export interface CanvasNodeMinimapProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  borderRadius: number
  shapeRendering: string
}

export interface CanvasNodeSelectionContext {
  zoom: number
}

export interface CanvasNodeSelection<TData extends CanvasNodeData = CanvasNodeData> {
  point?(node: Node<TData>, point: Point2D, context: CanvasNodeSelectionContext): boolean
  rectangle?(node: Node<TData>, rect: Bounds, context: CanvasNodeSelectionContext): boolean
  lasso?(node: Node<TData>, polygon: Array<Point2D>, context: CanvasNodeSelectionContext): boolean
}

export interface CanvasNodeModule<
  TData extends CanvasNodeData = CanvasNodeData,
  TType extends CanvasNodeType = CanvasNodeType,
> {
  type: TType
  renderPreview: (data: TData, options?: CanvasNodePreviewOptions) => ReactNode
  parseData: (data: CanvasNodeData) => TData | null
  create: (args: CanvasNodeCreateArgs) => { node: Node<TData, TType>; startEditing: boolean }
  placement?: CanvasNodePlacementBehavior
  properties?: (context: {
    node: Node<TData>
    updateNodeData: CanvasDocumentWriter['updateNodeData']
  }) => CanvasInspectableProperties
  selection?: CanvasNodeSelection<TData>
  renderMinimap?: (props: CanvasNodeMinimapProps) => ReactNode
  awareness?: CanvasAwarenessCapability
  resize?: (
    node: Node<TData>,
    resize: { width: number; height: number; position: XYPosition },
  ) => Node<TData>
}

export type AnyCanvasNodeModule = CanvasNodeModule<any, any>

interface CreateCanvasNodeModuleDefinition<
  TData extends CanvasNodeData,
  TType extends CanvasNodeType = CanvasNodeType,
> {
  type: TType
  renderPreview: (data: TData, options?: CanvasNodePreviewOptions) => ReactNode
  parseData: (data: CanvasNodeData) => TData | null
  defaultSize?: { width: number; height: number }
  buildDefaultData?: () => TData
  placement?: CanvasNodePlacementBehavior
  properties?: (context: {
    node: Node<TData>
    updateNodeData: CanvasDocumentWriter['updateNodeData']
  }) => CanvasInspectableProperties
  selection?: CanvasNodeSelection<TData>
  renderMinimap?: (props: CanvasNodeMinimapProps) => ReactNode
  awareness?: CanvasAwarenessCapability
  resize?: (
    node: Node<TData>,
    resize: { width: number; height: number; position: XYPosition },
  ) => Node<TData>
}

export function createCanvasNodeModule<
  TData extends CanvasNodeData,
  TType extends CanvasNodeType = CanvasNodeType,
>(definition: CreateCanvasNodeModuleDefinition<TData, TType>): CanvasNodeModule<TData, TType> {
  return {
    ...definition,
    create: ({ position, size, data }) => {
      const resolvedSize = size ?? definition.defaultSize
      if (!resolvedSize) {
        throw new Error(`Missing default canvas node size for "${definition.type}"`)
      }

      const resolvedPosition =
        definition.placement?.anchor === 'center'
          ? {
              x: position.x - resolvedSize.width / 2,
              y: position.y - resolvedSize.height / 2,
            }
          : position
      const resolvedData = data ?? definition.buildDefaultData?.()
      if (!resolvedData) {
        throw new Error(`Missing default canvas node data for "${definition.type}"`)
      }

      const node: Node<TData, TType> = {
        id: crypto.randomUUID(),
        type: definition.type,
        position: resolvedPosition,
        width: resolvedSize.width,
        height: resolvedSize.height,
        data: resolvedData as TData,
      }

      if (definition.placement?.selectOnCreate) {
        node.selected = true
        node.draggable = true
      }

      return {
        node,
        startEditing: definition.placement?.startEditingOnCreate ?? false,
      }
    },
  }
}

export function buildCanvasNodeTypes(
  components: ReadonlyArray<readonly [CanvasNodeType, ComponentType<NodeProps<Node>>]>,
): NodeTypes {
  const seen = new Map<CanvasNodeType, Array<string>>()
  const entries: Array<readonly [CanvasNodeType, ComponentType<NodeProps<Node>>]> = []

  for (const [type, Component] of components) {
    const componentName = Component.displayName || Component.name || 'anonymous'
    const existing = seen.get(type)
    if (existing) {
      existing.push(componentName)
      continue
    }

    seen.set(type, [componentName])
    entries.push([type, Component] as const)
  }

  const duplicates = Array.from(seen.entries()).filter(
    ([, componentNames]) => componentNames.length > 1,
  )
  if (duplicates.length > 0) {
    const duplicateSummary = duplicates
      .map(([type, componentNames]) => `"${type}" (${componentNames.join(', ')})`)
      .join(', ')
    throw new Error(`Duplicate canvas node module types: ${duplicateSummary}`)
  }

  return Object.fromEntries(entries) as NodeTypes
}

export function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

export function readNumber(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key]
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}
