import { EmbedNode, EmbedPreview } from './embed-node'
import type { EmbedNodeData } from './embed-node'
import { RectangleNode, RectanglePreview } from './rectangle-node'
import type { RectangleNodeData } from './rectangle-node'
import { StickyNode, StickyPreview } from './sticky-node'
import type { StickyNodeData } from './sticky-node'
import { StrokeNode, StrokePreview } from './stroke-node'
import type { StrokeNodeData } from './stroke-node'
import { TextNode, TextPreview } from './text-node'
import type { TextNodeData } from './text-node'
import type { Node, NodeProps, NodeTypes } from '@xyflow/react'

interface CanvasNodePreviewOptions {
  width: number
  height: number
}

type CanvasNodeData = Record<string, unknown>

interface CanvasNodeDescriptor<TPreviewData extends CanvasNodeData = CanvasNodeData> {
  component: React.ComponentType<NodeProps<Node<TPreviewData>>>
  renderPreview: (data: TPreviewData, options?: CanvasNodePreviewOptions) => React.ReactNode
  readPreviewData: (data: CanvasNodeData) => TPreviewData | null
}

function createCanvasNodeDescriptor<TPreviewData extends CanvasNodeData>(
  descriptor: CanvasNodeDescriptor<TPreviewData>,
): CanvasNodeDescriptor<TPreviewData> {
  return descriptor
}

const canvasNodeDescriptors = {
  embed: createCanvasNodeDescriptor<EmbedNodeData>({
    component: EmbedNode,
    renderPreview: () => <EmbedPreview />,
    readPreviewData: () => ({}),
  }),
  rectangle: createCanvasNodeDescriptor<RectangleNodeData>({
    component: RectangleNode,
    renderPreview: (data) => {
      return <RectanglePreview color={data.color ?? 'transparent'} opacity={data.opacity} />
    },
    readPreviewData: (data) => ({
      color: readString(data, 'color'),
      opacity: readNumber(data, 'opacity'),
    }),
  }),
  sticky: createCanvasNodeDescriptor<StickyNodeData>({
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
  }),
  stroke: createCanvasNodeDescriptor<StrokeNodeData>({
    component: StrokeNode,
    renderPreview: (data, options) => (
      <StrokePreview data={data} width={options?.width} height={options?.height} />
    ),
    readPreviewData: (data) => (isStrokeNodeData(data) ? data : null),
  }),
  text: createCanvasNodeDescriptor<TextNodeData>({
    component: TextNode,
    renderPreview: (data) => <TextPreview label={data.label ?? ''} />,
    readPreviewData: (data) => ({
      label: readString(data, 'label'),
    }),
  }),
} as const

export const canvasNodeTypes = Object.fromEntries(
  Object.entries(canvasNodeDescriptors).map(([type, descriptor]) => [type, descriptor.component]),
) satisfies NodeTypes

type CanvasNodeType = keyof typeof canvasNodeDescriptors

function isCanvasNodeType(type: string): type is CanvasNodeType {
  return type in canvasNodeDescriptors
}

export function renderCanvasNodePreview(
  type: string | undefined,
  data: CanvasNodeData,
  options?: CanvasNodePreviewOptions,
): React.ReactNode {
  if (!type || !isCanvasNodeType(type)) return null
  const descriptor = canvasNodeDescriptors[type] as CanvasNodeDescriptor<CanvasNodeData>
  const previewData = descriptor.readPreviewData(data)
  return previewData ? descriptor.renderPreview(previewData, options) : null
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
