import { createContext, use, useEffect, useLayoutEffect, useRef } from 'react'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { CanvasRenderModeContext } from '../runtime/providers/canvas-render-mode-context'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime'
import { useCanvasEditorRuntimeCore } from '../runtime/use-canvas-editor-runtime-core'
import { CanvasNodeContentRenderer } from '../components/canvas-node-content-renderer'
import { CanvasScene } from '../components/canvas-scene'
import { TextNode } from '../nodes/text/text-node'
import { StrokeNode } from '../nodes/stroke/stroke-node'
import {
  createCanvasDocumentDoc,
  getCanvasDocumentMaps,
  normalizeCanvasDocumentEdge,
  normalizeCanvasDocumentNode,
} from '../document-contract'
import { getCanvasFitViewport } from '../utils/canvas-fit-view'
import { readElementBorderBoxSize, readResizeObserverBorderBoxSize } from '../dom/element-size'
import { normalizeEmbedNodeData } from '../embed-node-model'
import { getCanvasNodeSurfaceStyle, getCanvasNodeTextStyle } from '../node-surface-style'
import { EmbeddedCanvasStateProvider } from '../embedded-canvas-state-context'
import { EmbeddedMapStateSourceProvider } from '../../game-maps/embedded-state-context'
import { EmbedContent } from '../../embeds/components/embed-content'
import { ResourceContentSourceProvider } from '../../filesystem/resource-content-context'
import { createEmbeddedNotePreviewRenderer } from '../../notes/embeds/embedded-note-preview-renderer'
import {
  standaloneEmbeddedNoteContentSource,
  standaloneNoteEmbedTargetSource,
  standaloneNoteLinkNavigationSource,
  standaloneNoteLinkResolutionSource,
  standaloneNoteValueReferences,
  standaloneNoteValueStateSource,
} from '../../notes/standalone-note-content-sources'
import { buildWikiLinkAutocompleteModelFromSource } from '../../notes/wiki-link/autocomplete-model'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'
import type { CanvasElementSize } from '../dom/element-size'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { CanvasViewportStore } from '../runtime/interaction/canvas-viewport-storage'
import type {
  NoteDocumentContentSource,
  NoteLinkCreationSource,
  NotePermissionContentSource,
  NotePlaybackContentSource,
  NoteSharingContentSource,
  NoteWikiLinkContentSource,
} from '../../notes/runtime'
import type { CanvasNodeRendererMap } from '../components/canvas-node-content-renderer'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { WikiLinkAutocompleteItemSource } from '../../notes/wiki-link/autocomplete-model'
import type { WikiLinkAutocompleteModelData } from '../../notes/wiki-link/autocomplete-source'
import type { EmbeddedCanvasStateSource } from '../embedded-canvas-state-context'
import type { EmbeddedMapStateSource } from '../../game-maps/embedded-state-context'
import type { ResourceContentSource } from '../../filesystem/resource-content-source'

const DEFAULT_MIN_ZOOM = 0.01
const DEFAULT_MAX_ZOOM = 4
const DEFAULT_FIT_PADDING = 0.12
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 }
const PREVIEW_WORKSPACE_ID = 'canvas-read-only-preview'
const CanvasReadOnlyPreviewSourceItemIdContext = createContext<SidebarItemId | null>(null)

interface CanvasReadOnlyPreviewProps {
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  interactive?: boolean
  fitPadding?: number
  minZoom?: number
  maxZoom?: number
  className?: string
  sourceItemId?: SidebarItemId | null
}

interface CanvasReadOnlyPreviewDocumentState {
  contentKey: string
  doc: ReturnType<typeof createCanvasDocumentDoc>
  edgesMap: ReturnType<typeof getCanvasDocumentMaps>['edgesMap']
  nodesMap: ReturnType<typeof getCanvasDocumentMaps>['nodesMap']
}

const readOnlyPreviewViewportStore: CanvasViewportStore = {
  loadCanvasViewport: () => DEFAULT_VIEWPORT,
  saveCanvasViewport: () => undefined,
}

const unavailableEmbeddedCanvasStateSource: EmbeddedCanvasStateSource = {
  useEmbeddedCanvasState: () => ({ status: 'unavailable' }),
}

const unavailableEmbeddedMapStateSource: EmbeddedMapStateSource = {
  resolveEmbeddedMapState: () => ({
    status: 'unavailable',
  }),
}

const unavailableResourceContentSource: ResourceContentSource = {
  status: 'available',
  ensureContentState: () => undefined,
  getContentState: (_itemId, fallbackLabel) => ({
    status: 'not_found',
    label: fallbackLabel ?? 'Embedded item',
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
  }),
  resolveItem: () => null,
}

const emptyWikiLinkAutocompleteItemSource: WikiLinkAutocompleteItemSource = {
  getItemBreadcrumbs: () => '',
  getItemLinkPath: () => [],
  queryItems: () => [],
  resolveFolderPath: () => null,
  resolveItemPath: () => null,
  resolveNotePath: () => null,
}

const emptyWikiLinkAutocompleteModelData: WikiLinkAutocompleteModelData = {
  context: null,
  headingsPending: false,
  model: buildWikiLinkAutocompleteModelFromSource({
    context: null,
    headings: [],
    itemSource: emptyWikiLinkAutocompleteItemSource,
    values: [],
  }),
  valuesPending: false,
}

const readOnlyPreviewNoteDocumentSource: NoteDocumentContentSource = {
  useNoteCollaborationSession: () => {
    throw new Error('Read-only canvas previews do not create collaboration sessions')
  },
}

const readOnlyPreviewNoteLinkCreationSource: NoteLinkCreationSource | null = null

const readOnlyPreviewNotePlaybackSource: NotePlaybackContentSource = {}

const readOnlyPreviewNoteSharingSource: NoteSharingContentSource = {
  blocks: { status: 'unsupported', reason: 'not_available' },
}

const readOnlyPreviewNoteWikiLinkSource: NoteWikiLinkContentSource = {
  useWikiLinkAutocompleteModelData: () => emptyWikiLinkAutocompleteModelData,
}

const readOnlyPreviewNotePermissionSource: NotePermissionContentSource = {
  canAccessItem: () => true,
  getMemberItemPermissionLevel: () => PERMISSION_LEVEL.FULL_ACCESS,
  selectedViewAsPlayerId: undefined,
}

export function CanvasReadOnlyPreview({
  nodes,
  edges,
  interactive = false,
  fitPadding = DEFAULT_FIT_PADDING,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  className,
  sourceItemId = null,
}: CanvasReadOnlyPreviewProps) {
  const content = normalizeCanvasPreviewContent(nodes, edges)
  const { doc, edgesMap, nodesMap } = useCanvasReadOnlyPreviewDocument(content)

  const runtime = useCanvasEditorRuntimeCore({
    nodesMap,
    edgesMap,
    canvasId: sourceItemId ?? (PREVIEW_WORKSPACE_ID as SidebarItemId),
    canEdit: false,
    provider: null,
    doc,
    initialViewport: DEFAULT_VIEWPORT,
    viewportStore: readOnlyPreviewViewportStore,
  })

  return (
    <div
      ref={runtime.canvasSurfaceRef}
      className={cn(
        'canvas-scene relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-background',
        !interactive && 'pointer-events-none',
        className,
      )}
      data-canvas-pane="true"
      data-testid="canvas-read-only-preview"
      aria-label="Canvas preview"
      tabIndex={-1}
      onContextMenu={preventCanvasPreviewMenu}
    >
      <CanvasReadOnlyPreviewRuntime
        fitPadding={fitPadding}
        maxZoom={maxZoom}
        minZoom={minZoom}
        runtime={runtime}
        sourceItemId={sourceItemId}
      />
    </div>
  )
}

function useCanvasReadOnlyPreviewDocument(content: {
  edges: Array<CanvasDocumentEdge>
  nodes: Array<CanvasDocumentNode>
}) {
  const contentKey = createReadOnlyPreviewContentKey(content)
  const documentStateRef = useRef<CanvasReadOnlyPreviewDocumentState | null>(null)
  if (!documentStateRef.current) {
    const doc = createCanvasDocumentDoc(content)
    documentStateRef.current = {
      contentKey,
      doc,
      ...getCanvasDocumentMaps(doc),
    }
  }
  const documentState = documentStateRef.current

  useLayoutEffect(() => {
    if (documentState.contentKey === contentKey) return

    documentState.doc.transact(() => {
      replaceCanvasDocumentMap(documentState.nodesMap, content.nodes)
      replaceCanvasDocumentMap(documentState.edgesMap, content.edges)
    }, 'canvas-read-only-preview-content')
    documentState.contentKey = contentKey
  }, [content.edges, content.nodes, contentKey, documentState])

  useEffect(() => () => documentState.doc.destroy(), [documentState])

  return documentState
}

function replaceCanvasDocumentMap<TRecord extends { id: string }>(
  map: { clear: () => void; set: (key: string, value: TRecord) => unknown },
  records: ReadonlyArray<TRecord>,
) {
  map.clear()
  for (const record of records) {
    map.set(record.id, record)
  }
}

function CanvasReadOnlyPreviewRuntime({
  fitPadding,
  maxZoom,
  minZoom,
  runtime,
  sourceItemId,
}: {
  fitPadding: number
  maxZoom: number
  minZoom: number
  runtime: ReturnType<typeof useCanvasEditorRuntimeCore>
  sourceItemId: SidebarItemId | null
}) {
  useCanvasReadOnlyPreviewAutoFit({
    fitPadding,
    maxZoom,
    minZoom,
    runtime,
  })

  return (
    <EmbeddedCanvasStateProvider source={unavailableEmbeddedCanvasStateSource}>
      <ResourceContentSourceProvider source={unavailableResourceContentSource}>
        <EmbeddedMapStateSourceProvider source={unavailableEmbeddedMapStateSource}>
          <CanvasEngineProvider engine={runtime.canvasEngine}>
            <CanvasRenderModeContext.Provider value="interactive">
              <CanvasRuntimeProvider
                canvasId={null}
                canEdit={false}
                commands={runtime.commands}
                documentWriter={runtime.documentWriter}
                domRuntime={runtime.domRuntime}
                editSession={runtime.editSession}
                history={runtime.history}
                isSidebarItemEmbedRichTextEditable={() => false}
                noteDocumentSource={readOnlyPreviewNoteDocumentSource}
                noteEmbeddedNoteContentSource={standaloneEmbeddedNoteContentSource}
                noteEmbedTargetSource={standaloneNoteEmbedTargetSource}
                noteLinkCreationSource={readOnlyPreviewNoteLinkCreationSource}
                noteLinkNavigationSource={standaloneNoteLinkNavigationSource}
                noteLinkResolutionSource={standaloneNoteLinkResolutionSource}
                notePlaybackSource={readOnlyPreviewNotePlaybackSource}
                notePermissionSource={readOnlyPreviewNotePermissionSource}
                noteSharingSource={readOnlyPreviewNoteSharingSource}
                noteValueReferences={standaloneNoteValueReferences}
                noteValueStateSource={standaloneNoteValueStateSource}
                noteWikiLinkSource={readOnlyPreviewNoteWikiLinkSource}
                nodeActions={runtime.nodeActions}
                provider={null}
                remoteNodeHighlights={runtime.remoteNodeHighlights}
                remoteEdgeHighlights={runtime.remoteEdgeHighlights}
                selection={runtime.selection}
                localOverlayStore={runtime.localOverlayStore}
                toolStore={runtime.toolStore}
                viewportController={runtime.viewportController}
              >
                <CanvasReadOnlyPreviewSourceItemIdContext.Provider value={sourceItemId}>
                  <CanvasScene
                    canEdit={false}
                    remoteUsers={runtime.remoteUsers}
                    sceneHandlers={runtime.sceneHandlers}
                    NodeContentComponent={CanvasReadOnlyPreviewNodeContentFromContext}
                    onNodeContextMenu={preventCanvasPreviewMenu}
                    onEdgeContextMenu={preventCanvasPreviewMenu}
                    onPaneContextMenu={preventCanvasPreviewMenu}
                  />
                </CanvasReadOnlyPreviewSourceItemIdContext.Provider>
              </CanvasRuntimeProvider>
            </CanvasRenderModeContext.Provider>
          </CanvasEngineProvider>
        </EmbeddedMapStateSourceProvider>
      </ResourceContentSourceProvider>
    </EmbeddedCanvasStateProvider>
  )
}

function CanvasReadOnlyPreviewNodeContentFromContext({ nodeId }: { nodeId: string }) {
  const sourceItemId = use(CanvasReadOnlyPreviewSourceItemIdContext)
  return <CanvasReadOnlyPreviewNodeContent nodeId={nodeId} sourceItemId={sourceItemId} />
}

function CanvasReadOnlyPreviewNodeContent({
  nodeId,
  sourceItemId,
}: {
  nodeId: string
  sourceItemId: SidebarItemId | null
}) {
  const renderers = {
    embed: (props) => <CanvasReadOnlyPreviewEmbedNode {...props} sourceItemId={sourceItemId} />,
    stroke: StrokeNode,
    text: TextNode,
  } satisfies CanvasNodeRendererMap

  return <CanvasNodeContentRenderer nodeId={nodeId} renderers={renderers} />
}

function CanvasReadOnlyPreviewEmbedNode({
  data,
  sourceItemId,
}: CanvasNodeComponentProps<'embed'> & {
  sourceItemId: SidebarItemId | null
}) {
  const normalizedData = normalizeEmbedNodeData(data)

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg select-none"
      style={{
        ...getCanvasNodeSurfaceStyle(normalizedData),
        ...getCanvasNodeTextStyle(normalizedData),
      }}
    >
      <div className="h-full w-full min-h-0 min-w-0">
        <EmbedContent
          target={normalizedData.target}
          sourceItemId={sourceItemId}
          mode="readonly"
          renderEmbeddedNotePreview={createEmbeddedNotePreviewRenderer({
            source: standaloneEmbeddedNoteContentSource,
          })}
        />
      </div>
    </div>
  )
}

function useCanvasReadOnlyPreviewAutoFit({
  fitPadding,
  maxZoom,
  minZoom,
  runtime,
}: {
  fitPadding: number
  maxZoom: number
  minZoom: number
  runtime: ReturnType<typeof useCanvasEditorRuntimeCore>
}) {
  const frameRef = useRef<number | null>(null)
  const lastFitKeyRef = useRef<string | null>(null)
  const surfaceSizeRef = useRef<CanvasElementSize>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    runtime.viewportController.setZoomBounds({ maxZoom, minZoom })
  }, [maxZoom, minZoom, runtime.viewportController])

  useLayoutEffect(() => {
    const surface = runtime.canvasSurfaceRef.current
    const scheduleFit = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        fitReadOnlyPreviewViewport({
          fitPadding,
          lastFitKeyRef,
          maxZoom,
          minZoom,
          runtime,
          size: surfaceSizeRef.current,
        })
      })
    }

    if (surface) {
      surfaceSizeRef.current = readElementBorderBoxSize(surface)
    }
    scheduleFit()
    const unsubscribe = runtime.canvasEngine.subscribe(scheduleFit)

    if (!surface || typeof ResizeObserver === 'undefined') {
      return () => {
        unsubscribe()
        cancelScheduledFrame(frameRef)
      }
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      surfaceSizeRef.current = readResizeObserverBorderBoxSize(entry)
      scheduleFit()
    })
    observer.observe(surface)

    return () => {
      unsubscribe()
      observer.disconnect()
      cancelScheduledFrame(frameRef)
    }
  }, [fitPadding, maxZoom, minZoom, runtime])
}

function fitReadOnlyPreviewViewport({
  fitPadding,
  lastFitKeyRef,
  maxZoom,
  minZoom,
  runtime,
  size,
}: {
  fitPadding: number
  lastFitKeyRef: RefObject<string | null>
  maxZoom: number
  minZoom: number
  runtime: ReturnType<typeof useCanvasEditorRuntimeCore>
  size: CanvasElementSize
}) {
  const nodes = getReadOnlyPreviewFitNodes(runtime.canvasEngine.getSnapshot())
  const fitKey = createReadOnlyPreviewFitKey({ fitPadding, maxZoom, minZoom, nodes, size })
  if (lastFitKeyRef.current === fitKey) return
  lastFitKeyRef.current = fitKey

  const viewport = getCanvasFitViewport({
    nodes,
    width: size.width,
    height: size.height,
    minZoom,
    maxZoom,
    padding: fitPadding,
  })
  if (viewport) {
    runtime.viewportController.syncFromDocumentOrAdapter(viewport)
  }
}

function getReadOnlyPreviewFitNodes({
  nodeLookup,
  nodes,
}: ReturnType<ReturnType<typeof useCanvasEditorRuntimeCore>['canvasEngine']['getSnapshot']>) {
  return nodes.map((node) => {
    if (typeof node.width === 'number' && typeof node.height === 'number') {
      return node
    }

    const measured = nodeLookup.get(node.id)?.measured
    return {
      ...node,
      ...(typeof node.width === 'number' || typeof measured?.width !== 'number'
        ? {}
        : { width: measured.width }),
      ...(typeof node.height === 'number' || typeof measured?.height !== 'number'
        ? {}
        : { height: measured.height }),
    }
  })
}

function createReadOnlyPreviewFitKey({
  fitPadding,
  maxZoom,
  minZoom,
  nodes,
  size,
}: {
  fitPadding: number
  maxZoom: number
  minZoom: number
  nodes: ReadonlyArray<CanvasDocumentNode>
  size: CanvasElementSize
}) {
  return JSON.stringify({
    fitPadding,
    maxZoom,
    minZoom,
    size,
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      width: node.width,
      height: node.height,
    })),
  })
}

function cancelScheduledFrame(frameRef: RefObject<number | null>) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }
}

function normalizeCanvasPreviewNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
): Array<CanvasDocumentNode> {
  return nodes.flatMap((node) => {
    const normalizedNode = normalizeCanvasDocumentNode(node)
    return normalizedNode ? [normalizedNode] : []
  })
}

function normalizeCanvasPreviewEdges(
  edges: ReadonlyArray<CanvasDocumentEdge>,
): Array<CanvasDocumentEdge> {
  return edges.flatMap((edge) => {
    const normalizedEdge = normalizeCanvasDocumentEdge(edge)
    return normalizedEdge ? [normalizedEdge] : []
  })
}

function normalizeCanvasPreviewContent(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
) {
  const normalizedNodes = normalizeCanvasPreviewNodes(nodes)
  const nodeIds = new Set<string>(normalizedNodes.map((node) => node.id))

  return {
    nodes: normalizedNodes,
    edges: normalizeCanvasPreviewEdges(edges).filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
  }
}

function createReadOnlyPreviewContentKey({
  edges,
  nodes,
}: {
  edges: ReadonlyArray<CanvasDocumentEdge>
  nodes: ReadonlyArray<CanvasDocumentNode>
}) {
  return JSON.stringify({ edges, nodes })
}

function preventCanvasPreviewMenu(event: ReactMouseEvent) {
  event.preventDefault()
}
