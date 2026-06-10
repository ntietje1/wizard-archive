import * as Y from 'yjs'
import { useEffect, useState } from 'react'
import { CanvasEditorRuntimeHost } from '~/features/canvas/components/canvas-editor-runtime-host'
import { CanvasNodeContentRenderer } from '~/features/canvas/components/canvas-node-content-renderer'
import { EmbedNode } from '~/features/canvas/nodes/embed/embed-node'
import { StrokeNode } from '~/features/canvas/nodes/stroke/stroke-node'
import { TextNode } from '~/features/canvas/nodes/text/text-node'
import { useCanvasToolStore } from '~/features/canvas/stores/canvas-tool-store'
import { useCanvasEditorRuntimeCore } from '~/features/canvas/runtime/use-canvas-editor-runtime-core'
import type { CanvasNodeRendererMap } from '~/features/canvas/components/canvas-node-content-renderer'
import type { EmbeddedCanvasStateResolver } from '~/features/canvas/nodes/embed/embedded-canvas-state-resolution'
import type { EmbedSidebarItemResolver } from '~/features/embeds/context/embed-sidebar-item-resolution'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import type { Id } from 'convex/_generated/dataModel'

const LOCAL_CANVAS_NODE_RENDERERS = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const satisfies CanvasNodeRendererMap

interface LocalCanvasEditorProps {
  canvasId: Id<'sidebarItems'>
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  EmbeddedCanvasStateResolver?: EmbeddedCanvasStateResolver
  SidebarItemEmbedResolver?: EmbedSidebarItemResolver
}

export function LocalCanvasEditor({
  canvasId,
  nodes,
  edges,
  EmbeddedCanvasStateResolver,
  SidebarItemEmbedResolver,
}: LocalCanvasEditorProps) {
  const document = useLocalCanvasDocumentSource({ canvasId, nodes, edges })
  const runtime = useCanvasEditorRuntimeCore({
    canvasId: document.canvasId,
    doc: document.doc,
    nodesMap: document.nodesMap,
    edgesMap: document.edgesMap,
    canvasParentId: null,
    canEdit: true,
    provider: null,
    initialViewport: { x: 0, y: 0, zoom: 1 },
  })
  const canvasCursor = runtime.toolCursor ?? 'pointer'

  return (
    <CanvasEditorRuntimeHost
      canvasId={document.canvasId}
      canEdit
      canvasCursor={canvasCursor}
      NodeContentComponent={LocalCanvasNodeContent}
      runtime={runtime}
      EmbeddedCanvasStateResolver={EmbeddedCanvasStateResolver}
      SidebarItemEmbedResolver={SidebarItemEmbedResolver}
    />
  )
}

function useLocalCanvasDocumentSource({
  canvasId,
  edges,
  nodes,
}: {
  canvasId: Id<'sidebarItems'>
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
}) {
  const [document] = useState<{
    canvasId: Id<'sidebarItems'>
    doc: Y.Doc
    nodesMap: Y.Map<CanvasDocumentNode>
    edgesMap: Y.Map<CanvasDocumentEdge>
  }>(() => {
    const doc = new Y.Doc()
    const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
    const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
    doc.transact(() => {
      nodes.forEach((node) => nodesMap.set(node.id, node))
      edges.forEach((edge) => edgesMap.set(edge.id, edge))
    }, 'demo-canvas-init')
    return { canvasId, doc, nodesMap, edgesMap }
  })

  useEffect(() => {
    return () => {
      useCanvasToolStore.getState().reset()
      document.doc.destroy()
    }
  }, [document])

  return document
}

function LocalCanvasNodeContent({ nodeId }: { nodeId: string }) {
  return <CanvasNodeContentRenderer nodeId={nodeId} renderers={LOCAL_CANVAS_NODE_RENDERERS} />
}
