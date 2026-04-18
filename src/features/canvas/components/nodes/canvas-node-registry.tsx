import { EmbedNode, EmbedPreview } from './embed-node'
import { RectangleNode, RectanglePreview } from './rectangle-node'
import { StickyNode, StickyPreview } from './sticky-node'
import { StrokeNode, StrokePreview } from './stroke-node'
import { TextNode, TextPreview } from './text-node'
import type { StrokeNodeData } from './stroke-node'
import type { NodeTypes } from '@xyflow/react'

export const canvasNodeTypes = {
  embed: EmbedNode,
  rectangle: RectangleNode,
  sticky: StickyNode,
  stroke: StrokeNode,
  text: TextNode,
} satisfies NodeTypes

interface CanvasNodePreviewOptions {
  width: number
  height: number
}

type TextPreviewData = {
  label?: string
}

type StickyPreviewData = {
  label?: string
  color?: string
  opacity?: number
}

type RectanglePreviewData = {
  color?: string
  opacity?: number
}

export type CanvasNodePreview =
  | { type: 'stroke'; data: StrokeNodeData }
  | { type: 'text'; data: TextPreviewData }
  | { type: 'sticky'; data: StickyPreviewData }
  | { type: 'rectangle'; data: RectanglePreviewData }
  | { type: 'embed'; data: Record<string, never> }

export function toCanvasNodePreview(
  type: string | undefined,
  data: Record<string, unknown>,
): CanvasNodePreview | null {
  switch (type) {
    case 'stroke':
      return isStrokeNodeData(data) ? { type, data } : null
    case 'text':
      return { type, data: { label: readString(data, 'label') } }
    case 'sticky':
      return {
        type,
        data: {
          label: readString(data, 'label'),
          color: readString(data, 'color'),
          opacity: readNumber(data, 'opacity'),
        },
      }
    case 'rectangle':
      return {
        type,
        data: {
          color: readString(data, 'color'),
          opacity: readNumber(data, 'opacity'),
        },
      }
    case 'embed':
      return { type, data: {} }
    default:
      return null
  }
}

export function renderCanvasNodePreview(
  preview: CanvasNodePreview,
  { width, height }: CanvasNodePreviewOptions,
): React.ReactNode {
  switch (preview.type) {
    case 'stroke':
      return <StrokePreview data={preview.data} width={width} height={height} />
    case 'text':
      return <TextPreview label={preview.data.label ?? ''} />
    case 'sticky':
      return (
        <StickyPreview
          label={preview.data.label ?? ''}
          color={preview.data.color ?? 'transparent'}
          opacity={preview.data.opacity}
        />
      )
    case 'rectangle':
      return <RectanglePreview color={preview.data.color ?? 'transparent'} opacity={preview.data.opacity} />
    case 'embed':
      return <EmbedPreview />
    default:
      return null
  }
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
    value.every((part) => typeof part === 'number')
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
