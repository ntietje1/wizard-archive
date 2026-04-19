import { RectanglePreview } from './rectangle-node'
import type { RectangleNodeData } from './rectangle-node'
import { StickyPreview } from './sticky-node'
import type { StickyNodeData } from './sticky-node'
import { StrokePreview } from './stroke-node'
import { TextPreview } from './text-node'
import type { TextNodeData } from './text-node'
import { EmbedPreview } from './embed-node-preview'
import { parseEmbedNodeData } from './embed-node-data'
import { readNumber, readString } from './canvas-node-module-types'
import type {
  CanvasNodeData,
  CanvasNodePreviewOptions,
  CanvasNodeType,
} from './canvas-node-module-types'
import { STICKY_DEFAULT_COLOR, STICKY_DEFAULT_OPACITY } from './sticky-node-constants'
import type { StrokeNodeData } from './stroke-node-model'
import type { ReactNode } from 'react'

type CanvasNodePreviewDefinition = {
  parseData: (data: CanvasNodeData) => CanvasNodeData | null
  renderPreview: (data: CanvasNodeData, options?: CanvasNodePreviewOptions) => ReactNode
}

function hasFiniteBounds(
  value: unknown,
): value is { x: number; y: number; width: number; height: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'x' in value &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    'y' in value &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    'width' in value &&
    typeof value.width === 'number' &&
    Number.isFinite(value.width) &&
    'height' in value &&
    typeof value.height === 'number' &&
    Number.isFinite(value.height)
  )
}

const canvasNodePreviewDefinitions: Record<CanvasNodeType, CanvasNodePreviewDefinition> = {
  embed: {
    parseData: parseEmbedNodeData,
    renderPreview: () => <EmbedPreview />,
  },
  rectangle: {
    parseData: (data) => {
      const color = readString(data, 'color')
      const opacity = readNumber(data, 'opacity')

      if (color === undefined && opacity === undefined) {
        return null
      }

      return { color, opacity } satisfies RectangleNodeData
    },
    renderPreview: (data) => (
      <RectanglePreview
        color={(data as RectangleNodeData).color ?? 'var(--foreground)'}
        opacity={(data as RectangleNodeData).opacity}
      />
    ),
  },
  sticky: {
    parseData: (data) =>
      ({
        label: readString(data, 'label'),
        color: readString(data, 'color'),
        opacity: readNumber(data, 'opacity'),
      }) satisfies StickyNodeData,
    renderPreview: (data) => (
      <StickyPreview
        label={(data as StickyNodeData).label ?? ''}
        color={(data as StickyNodeData).color ?? STICKY_DEFAULT_COLOR}
        opacity={(data as StickyNodeData).opacity ?? STICKY_DEFAULT_OPACITY}
      />
    ),
  },
  stroke: {
    parseData: (data) => {
      if (
        !Array.isArray(data.points) ||
        typeof data.color !== 'string' ||
        typeof data.size !== 'number' ||
        !Number.isFinite(data.size) ||
        !hasFiniteBounds(data.bounds)
      ) {
        return null
      }

      return data as StrokeNodeData
    },
    renderPreview: (data, options) => (
      <StrokePreview
        data={data as StrokeNodeData}
        width={options?.width}
        height={options?.height}
      />
    ),
  },
  text: {
    parseData: (data) =>
      ({
        label: readString(data, 'label'),
      }) satisfies TextNodeData,
    renderPreview: (data) => <TextPreview label={(data as TextNodeData).label ?? ''} />,
  },
}

export function renderCanvasNodePreview(
  type: string | undefined,
  data: CanvasNodeData,
  options?: CanvasNodePreviewOptions,
): ReactNode {
  if (!type || !(type in canvasNodePreviewDefinitions)) {
    return null
  }

  const definition = canvasNodePreviewDefinitions[type as CanvasNodeType]
  const previewData = definition.parseData(data)
  return previewData ? definition.renderPreview(previewData, options) : null
}
