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
import type { Id } from 'convex/_generated/dataModel'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

export type CanvasReadOnlyPreviewEmbedRenderer = ComponentType<
  CanvasNodeComponentProps<EmbedNodeData> & { sourceItemId?: Id<'sidebarItems'> | null }
>

const PREVIEW_NODE_RENDERERS = {
  embed: CanvasPreviewDefaultEmbedNode,
  stroke: CanvasPreviewStrokeNode,
  text: CanvasPreviewTextNode,
} as const satisfies CanvasNodeRendererMap

function getPreviewNodeRenderers(
  embedRenderer?: CanvasReadOnlyPreviewEmbedRenderer,
  sourceItemId?: Id<'sidebarItems'> | null,
): CanvasNodeRendererMap {
  if (!embedRenderer) return PREVIEW_NODE_RENDERERS

  const EmbedRenderer = embedRenderer
  const renderers = {
    ...PREVIEW_NODE_RENDERERS,
    embed: (props: CanvasNodeComponentProps<EmbedNodeData>) => (
      <EmbedRenderer {...props} sourceItemId={sourceItemId ?? null} />
    ),
  } satisfies CanvasNodeRendererMap
  return renderers
}

export function CanvasPreviewNodeRenderer({
  embedRenderer,
  interactive,
  onNodeContextMenu,
  sourceItemId,
}: {
  embedRenderer?: CanvasReadOnlyPreviewEmbedRenderer
  interactive: boolean
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  sourceItemId?: Id<'sidebarItems'> | null
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  const renderers = getPreviewNodeRenderers(embedRenderer, sourceItemId)

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
