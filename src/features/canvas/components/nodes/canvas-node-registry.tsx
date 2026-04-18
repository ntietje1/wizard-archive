import { EmbedNode, EmbedPreview } from './embed-node'
import type { EmbedNodeData } from './embed-node'
import { RectangleNode, RectanglePreview } from './rectangle-node'
import type { RectangleNodeData } from './rectangle-node'
import { StickyNode, StickyPreview } from './sticky-node'
import type { StickyNodeData } from './sticky-node'
import { StrokeNode, StrokePreview } from './stroke-node'
import type { StrokeNodeData, StrokeNodeType } from './stroke-node'
import { TextNode, TextPreview } from './text-node'
import type { TextNodeData } from './text-node'
import type { Node, NodeProps, NodeTypes, XYPosition } from '@xyflow/react'

interface CanvasNodePreviewOptions {
  width: number
  height: number
}

type CanvasNodeData = Record<string, unknown>

type CanvasNodeType = 'embed' | 'rectangle' | 'sticky' | 'stroke' | 'text'

interface CanvasNodePlacementBehavior {
  anchor: 'center' | 'top-left'
  selectOnCreate: boolean
  startEditingOnCreate: boolean
}

interface CanvasNodeDefinition<
  TPreviewData extends CanvasNodeData = CanvasNodeData,
  TNode extends Node<TPreviewData> = Node<TPreviewData>,
> {
  component: React.ComponentType<NodeProps<TNode>>
  renderPreview: (data: TPreviewData, options?: CanvasNodePreviewOptions) => React.ReactNode
  readPreviewData: (data: CanvasNodeData) => TPreviewData | null
  styleControls: {
    color: boolean
    opacity: boolean
  }
  defaultSize?: { width: number; height: number }
  buildDefaultData?: () => TPreviewData
  placement?: CanvasNodePlacementBehavior
}

function createCanvasNodeDefinition<
  TPreviewData extends CanvasNodeData,
  TNode extends Node<TPreviewData> = Node<TPreviewData>,
>(definition: CanvasNodeDefinition<TPreviewData, TNode>): CanvasNodeDefinition<TPreviewData, TNode> {
  return definition
}

const EMBED_SIDEBAR_SIZE = { width: 320, height: 240 } as const

const canvasNodeDefinitions = {
  embed: createCanvasNodeDefinition<EmbedNodeData>({
    component: EmbedNode,
    renderPreview: () => <EmbedPreview />,
    readPreviewData: () => ({}),
    styleControls: {
      color: false,
      opacity: false,
    },
    defaultSize: EMBED_SIDEBAR_SIZE,
    buildDefaultData: () => ({}),
    placement: {
      anchor: 'top-left',
      selectOnCreate: false,
      startEditingOnCreate: false,
    },
  }),
  rectangle: createCanvasNodeDefinition<RectangleNodeData>({
    component: RectangleNode,
    renderPreview: (data) => {
      return <RectanglePreview color={data.color ?? 'transparent'} opacity={data.opacity} />
    },
    readPreviewData: (data) => ({
      color: readString(data, 'color'),
      opacity: readNumber(data, 'opacity'),
    }),
    styleControls: {
      color: true,
      opacity: true,
    },
    buildDefaultData: () => ({
      color: 'var(--foreground)',
      opacity: 100,
    }),
    placement: {
      anchor: 'top-left',
      selectOnCreate: true,
      startEditingOnCreate: false,
    },
  }),
  sticky: createCanvasNodeDefinition<StickyNodeData>({
    component: StickyNode,
    renderPreview: (data) => {
      return (
        <StickyPreview
          label={data.label ?? ''}
          color={data.color ?? 'transparent'}
          opacity={data.opacity}
        />
      )
    },
    readPreviewData: (data) => ({
      label: readString(data, 'label'),
      color: readString(data, 'color'),
      opacity: readNumber(data, 'opacity'),
    }),
    styleControls: {
      color: true,
      opacity: true,
    },
    defaultSize: { width: 160, height: 160 },
    buildDefaultData: () => ({
      label: '',
      color: '#FFEBA1',
      opacity: 100,
    }),
    placement: {
      anchor: 'center',
      selectOnCreate: true,
      startEditingOnCreate: true,
    },
  }),
  stroke: createCanvasNodeDefinition<StrokeNodeData, StrokeNodeType>({
    component: StrokeNode,
    renderPreview: (data, options) => (
      <StrokePreview data={data} width={options?.width} height={options?.height} />
    ),
    readPreviewData: (data) => (isStrokeNodeData(data) ? data : null),
    styleControls: {
      color: true,
      opacity: true,
    },
  }),
  text: createCanvasNodeDefinition<TextNodeData>({
    component: TextNode,
    renderPreview: (data) => <TextPreview label={data.label ?? ''} />,
    readPreviewData: (data) => ({
      label: readString(data, 'label'),
    }),
    styleControls: {
      color: false,
      opacity: false,
    },
    defaultSize: { width: 120, height: 36 },
    buildDefaultData: () => ({
      label: 'New text',
    }),
    placement: {
      anchor: 'center',
      selectOnCreate: true,
      startEditingOnCreate: true,
    },
  }),
} as const

export const canvasNodeTypes = Object.fromEntries(
  Object.entries(canvasNodeDefinitions).map(([type, definition]) => [type, definition.component]),
) satisfies NodeTypes

function isCanvasNodeType(type: string): type is CanvasNodeType {
  return type in canvasNodeDefinitions
}

export function getCanvasNodeDefinition(type: CanvasNodeType) {
  return canvasNodeDefinitions[type]
}

export function canEditCanvasNodeStyle(type: string | undefined): boolean {
  if (!type || !isCanvasNodeType(type)) return false
  const { color, opacity } = canvasNodeDefinitions[type].styleControls
  return color || opacity
}

export function renderCanvasNodePreview(
  type: string | undefined,
  data: CanvasNodeData,
  options?: CanvasNodePreviewOptions,
): React.ReactNode {
  if (!type || !isCanvasNodeType(type)) return null
  const definition = canvasNodeDefinitions[type] as CanvasNodeDefinition<CanvasNodeData>
  const previewData = definition.readPreviewData(data)
  return previewData ? definition.renderPreview(previewData, options) : null
}

export function createCanvasNode(
  type: CanvasNodeType,
  {
    position,
    size,
    data,
  }: {
    position: XYPosition
    size?: { width: number; height: number }
    data?: CanvasNodeData
  },
): Node {
  const definition = canvasNodeDefinitions[type]
  const resolvedSize = size ?? definition.defaultSize
  if (!resolvedSize) {
    throw new Error(`Missing default canvas node size for "${type}"`)
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
    throw new Error(`Missing default canvas node data for "${type}"`)
  }

  const node: Node = {
    id: crypto.randomUUID(),
    type,
    position: resolvedPosition,
    width: resolvedSize.width,
    height: resolvedSize.height,
    data: resolvedData,
  }

  if (definition.placement?.selectOnCreate) {
    node.selected = true
    node.draggable = true
  }

  return node
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(data: Record<string, unknown>, key: string): number | undefined {
  const value = data[key]
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined
}

function isStrokeNodeData(data: Record<string, unknown>): data is StrokeNodeData {
  if (!Array.isArray(data.points)) return false
  if (data.points.length === 0) return false
  if (typeof data.color !== 'string') return false
  if (typeof data.size !== 'number') return false
  if (!isBounds(data.bounds)) return false
  return data.points.every(isStrokePoint)
}

function isStrokePoint(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((part) => typeof part === 'number' && Number.isFinite(part))
  )
}

function isBounds(value: unknown): value is StrokeNodeData['bounds'] {
  if (!value || typeof value !== 'object') return false

  return (
    'x' in value &&
    typeof value.x === 'number' &&
    'y' in value &&
    typeof value.y === 'number' &&
    'width' in value &&
    typeof value.width === 'number' &&
    'height' in value &&
    typeof value.height === 'number'
  )
}
