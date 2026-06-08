import { CanvasNodeContentRenderer } from './canvas-node-content-renderer'
import { areArraysEqual } from './canvas-renderer-utils'
import { CanvasPreviewEdgeLayer } from './canvas-preview-edge-layer'
import { CanvasPreviewDefaultEmbedNode } from './canvas-preview-default-embed-node'
import { CanvasPreviewNodeShell } from './canvas-preview-node-shell'
import { CanvasPreviewStrokeNode } from './canvas-preview-stroke-node'
import { CanvasPreviewTextNode } from './canvas-preview-text-node'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { createContext, use } from 'react'
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

type PreviewEmbedRendererContextValue = {
  EmbedRenderer: CanvasReadOnlyPreviewEmbedRenderer
  sourceItemId: Id<'sidebarItems'> | null
}

const PreviewEmbedRendererContext = createContext<PreviewEmbedRendererContextValue | null>(null)

const PREVIEW_NODE_RENDERERS = {
  embed: CanvasPreviewDefaultEmbedNode,
  stroke: CanvasPreviewStrokeNode,
  text: CanvasPreviewTextNode,
} as const satisfies CanvasNodeRendererMap

const PREVIEW_EMBED_RENDERERS = {
  ...PREVIEW_NODE_RENDERERS,
  embed: CanvasPreviewProvidedEmbedNode,
} as const satisfies CanvasNodeRendererMap

function getPreviewNodeRenderers(
  embedRenderer?: CanvasReadOnlyPreviewEmbedRenderer,
): CanvasNodeRendererMap {
  if (!embedRenderer) return PREVIEW_NODE_RENDERERS
  return PREVIEW_EMBED_RENDERERS
}

function CanvasPreviewProvidedEmbedNode(props: CanvasNodeComponentProps<EmbedNodeData>) {
  const context = use(PreviewEmbedRendererContext)
  if (!context) return <CanvasPreviewDefaultEmbedNode {...props} />
  const { EmbedRenderer, sourceItemId } = context
  return <EmbedRenderer {...props} sourceItemId={sourceItemId} />
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
  const renderers = getPreviewNodeRenderers(embedRenderer)
  const content = nodeIds.map((nodeId) => (
    <CanvasPreviewNodeShell
      key={nodeId}
      interactive={interactive}
      nodeId={nodeId}
      onNodeContextMenu={onNodeContextMenu}
    >
      <CanvasNodeContentRenderer nodeId={nodeId} renderers={renderers} />
    </CanvasPreviewNodeShell>
  ))

  if (!embedRenderer) return content

  return (
    <PreviewEmbedRendererContext.Provider
      value={{ EmbedRenderer: embedRenderer, sourceItemId: sourceItemId ?? null }}
    >
      {content}
    </PreviewEmbedRendererContext.Provider>
  )
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
