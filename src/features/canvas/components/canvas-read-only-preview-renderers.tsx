import { CanvasNodeContentRenderer } from './canvas-node-content-renderer'
import { areArraysEqual } from './canvas-renderer-utils'
import { CanvasPreviewEdgeLayer } from './canvas-preview-edge-layer'
import { CanvasPreviewDefaultEmbedNode } from './canvas-preview-default-embed-node'
import { CanvasPreviewNodeShell } from './canvas-preview-node-shell'
import { CanvasPreviewStrokeNode } from './canvas-preview-stroke-node'
import { CanvasPreviewTextNode } from './canvas-preview-text-node'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasNodeRendererMap } from './canvas-node-content-renderer'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

export type CanvasReadOnlyPreviewEmbedRenderer = ComponentType<
  CanvasNodeComponentProps<EmbedNodeData>
>

const PREVIEW_NODE_RENDERERS = {
  embed: CanvasPreviewDefaultEmbedNode,
  stroke: CanvasPreviewStrokeNode,
  text: CanvasPreviewTextNode,
} as const satisfies CanvasNodeRendererMap

export function CanvasPreviewNodeRenderer({
  embedRenderer,
  interactive,
  onNodeContextMenu,
}: {
  embedRenderer?: CanvasReadOnlyPreviewEmbedRenderer
  interactive: boolean
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  const renderers = embedRenderer
    ? ({ ...PREVIEW_NODE_RENDERERS, embed: embedRenderer } satisfies CanvasNodeRendererMap)
    : PREVIEW_NODE_RENDERERS

  return nodeIds.map((nodeId) => (
    <CanvasPreviewNodeShell
      key={nodeId}
      interactive={interactive}
      nodeId={nodeId}
      onNodeContextMenu={onNodeContextMenu}
    >
      <CanvasNodeContentRenderer nodeId={nodeId} renderers={renderers} />
    </CanvasPreviewNodeShell>
  ))
}

export function CanvasPreviewEdgeRenderer({
  interactive,
  onEdgeContextMenu,
}: {
  interactive: boolean
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeIds = useCanvasEngineSelector((snapshot) => snapshot.edgeIds, areArraysEqual)
  return edgeIds.map((edgeId) => (
    <CanvasPreviewEdgeLayer
      key={edgeId}
      edgeId={edgeId}
      interactive={interactive}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
}
