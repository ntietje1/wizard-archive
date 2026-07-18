import { useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { CanvasReadonlyPreview } from '../../canvas/canvas-readonly-preview'
import type { CanvasDocumentNode } from '../../canvas/document-contract'
import { canvasEmbedLabel } from '../../canvas/canvas-embed-label'
import { NoteSessionEditor } from '../../notes/note-session-editor'
import { MapEmbedPreview } from '../../maps/map-embed-preview'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import type {
  CanvasPreviewSource,
  MapPreviewSource,
  NoteSessionSource,
} from '../content-session-contract'
import type {
  AuthorizedResourceSummary,
  CollectionKnowledge,
  ResourceIndexLoader,
  ResourceLoadResult,
  WorkspaceResourceIndex,
} from '../resource-index-contract'
import type { ResourceId } from '../domain-id'
import type { BlockNoteActivation } from '../../rich-text/blocknote/use-blocknote-activation'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { resourceKindIcon } from './resource-presentation'
import { useEnsureResourceCollection } from './resource-loading'

const MISSING_RESOURCE = { state: 'missing' as const }

export function CanvasResourceEmbed({
  activation,
  canEdit,
  canvases,
  editing,
  index,
  loader,
  maps,
  node,
  notes,
  zoom = 1,
}: {
  activation: BlockNoteActivation | null
  canEdit: boolean
  canvases: CanvasPreviewSource
  editing: boolean
  index: WorkspaceResourceIndex
  loader: ResourceIndexLoader
  maps: MapPreviewSource
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  notes: NoteSessionSource
  zoom?: number
}) {
  const resourceId =
    node.data.destination?.kind === 'internal' ? node.data.destination.target.resourceId : null
  const snapshot = useSyncExternalStore(
    (listener) => index.subscribe(listener),
    () => index.getSnapshot(),
    () => index.getSnapshot(),
  )
  const resource = resourceId ? snapshot.lookup(resourceId) : MISSING_RESOURCE
  const folderId =
    resource.state === 'known' && resource.value.kind === 'folder' ? resource.value.id : null
  const folderCollection = folderId
    ? snapshot.list({ parentId: folderId, lifecycle: 'active' })
    : null

  useEffect(() => {
    if (resourceId && resource.state === 'unknown') void loader.ensureResource(resourceId)
  }, [loader, resource.state, resourceId])
  if (resource.state !== 'known') {
    return (
      <CanvasEmbedFrame label={canvasEmbedLabel(node)} missing zoom={zoom}>
        <CanvasEmbedFallback node={node} />
      </CanvasEmbedFrame>
    )
  }
  if (resource.value.kind === 'note') {
    return (
      <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
        <CanvasNoteResourceEmbed
          activation={activation}
          canEdit={canEdit}
          editing={editing}
          label={`${resource.value.title} embedded note`}
          notes={notes}
          resourceId={resource.value.id}
        />
      </CanvasEmbedFrame>
    )
  }
  if (resource.value.kind === 'canvas') {
    return (
      <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
        <CanvasDocumentResourceEmbed canvases={canvases} resourceId={resource.value.id} />
      </CanvasEmbedFrame>
    )
  }
  if (resource.value.kind === 'folder') {
    return (
      <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
        <CanvasFolderResourceEmbed
          collection={folderCollection}
          folderId={resource.value.id}
          loader={loader}
        />
      </CanvasEmbedFrame>
    )
  }
  if (resource.value.kind === 'map') {
    return (
      <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
        <CanvasMapResourceEmbed
          maps={maps}
          resourceId={resource.value.id}
          title={resource.value.title}
        />
      </CanvasEmbedFrame>
    )
  }
  return (
    <CanvasEmbedFrame label={resource.value.title} zoom={zoom}>
      <CanvasEmbedFallback node={node} />
    </CanvasEmbedFrame>
  )
}

function CanvasFolderResourceEmbed({
  collection,
  folderId,
  loader,
}: {
  collection: CollectionKnowledge<AuthorizedResourceSummary> | null
  folderId: ResourceId
  loader: ResourceIndexLoader
}) {
  const load = useEnsureResourceCollection(
    loader,
    { parentId: folderId, lifecycle: 'active' },
    collection?.state === 'unknown',
  )
  if (collection?.state !== 'known' && !load.result) {
    return <span className="flex size-full items-center justify-center p-3">Loading folder</span>
  }
  if (collection?.state === 'known' && collection.complete && collection.items.length === 0) {
    return <span className="flex size-full items-center justify-center p-3">Folder is empty</span>
  }
  const items = collection?.state === 'known' ? collection.items : []
  const continuation = folderContinuation(collection, load.result)
  return (
    <ScrollArea className="size-full">
      <ul aria-label="Folder contents" className="flex flex-col gap-1 p-2">
        {items.map((item) => {
          const Icon = resourceKindIcon(item.kind)
          return (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{item.title}</span>
            </li>
          )
        })}
        {continuation && (
          <li>
            {continuation.action ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                disabled={load.loading}
                onClick={load.retry}
              >
                {load.loading && <Loader2 className="size-3 animate-spin" />}
                {continuation.label}
              </button>
            ) : (
              <span
                className="block px-2 py-1.5 text-center text-xs text-muted-foreground"
                role="status"
              >
                {continuation.label}
              </span>
            )}
          </li>
        )}
      </ul>
    </ScrollArea>
  )
}

function folderContinuation(
  collection: CollectionKnowledge<AuthorizedResourceSummary> | null,
  result: ResourceLoadResult | null,
): Readonly<{ action: boolean; label: string }> | null {
  if (result?.status === 'failed') {
    return {
      action: result.retryable,
      label: result.retryable ? 'Try loading folder again' : 'Folder could not be loaded',
    }
  }
  if (result?.status === 'unavailable') {
    return { action: false, label: 'Folder preview unavailable' }
  }
  if (result?.status === 'scope_changed') {
    return { action: false, label: 'Folder preview changed' }
  }
  if (collection?.state !== 'known' || collection.complete) return null
  return { action: true, label: 'Load more resources' }
}

function CanvasMapResourceEmbed({
  maps,
  resourceId,
  title,
}: {
  maps: MapPreviewSource
  resourceId: ResourceId
  title: string
}) {
  const state = useContentSnapshot(maps, resourceId)
  return state.status === 'ready' ? (
    <MapEmbedPreview preview={state.preview} title={title} />
  ) : (
    <span className="flex size-full items-center justify-center p-3">Map unavailable</span>
  )
}

function CanvasEmbedFrame({
  children,
  label,
  missing = false,
  zoom,
}: {
  children: ReactNode
  label: string
  missing?: boolean
  zoom: number
}) {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return (
    <div className="relative size-full">
      <div
        className="pointer-events-none absolute top-0 left-0 z-20 w-full select-none"
        data-testid="canvas-embed-floating-label-frame"
        style={{
          height: 16 / safeZoom,
          transform: `translateY(calc(-100% - ${6 / safeZoom}px))`,
        }}
      >
        <span
          className="absolute bottom-0 left-0 block truncate text-xs font-medium text-muted-foreground"
          data-testid="canvas-embed-floating-label"
          style={{
            lineHeight: '16px',
            transform: `scale(${1 / safeZoom})`,
            transformOrigin: 'left bottom',
            width: `${safeZoom * 100}%`,
          }}
        >
          {missing ? `Warning: ${label}` : label}
        </span>
      </div>
      <div className="size-full overflow-hidden rounded-md">{children}</div>
    </div>
  )
}

function CanvasNoteResourceEmbed({
  activation,
  canEdit,
  editing,
  label,
  notes,
  resourceId,
}: {
  activation: BlockNoteActivation | null
  canEdit: boolean
  editing: boolean
  label: string
  notes: NoteSessionSource
  resourceId: ResourceId
}) {
  const state = useContentSnapshot(notes, resourceId)
  if (state.status !== 'initializing' && state.status !== 'ready') {
    return <span className="p-3">Note unavailable</span>
  }
  return (
    <CanvasNoteSurface canEdit={canEdit} editing={editing}>
      <NoteSessionEditor
        activation={editing ? (activation ?? undefined) : undefined}
        canEdit={editing}
        formattingToolbar={false}
        label={label}
        scroll={EPHEMERAL_NOTE_SCROLL}
        state={state}
      />
    </CanvasNoteSurface>
  )
}

function CanvasNoteSurface({
  canEdit,
  children,
  editing,
}: {
  canEdit: boolean
  children: ReactNode
  editing: boolean
}) {
  return (
    <div
      className="flex size-full min-h-0 flex-col overflow-hidden text-left"
      data-canvas-editable-embed={canEdit && !editing}
    >
      {children}
    </div>
  )
}

function CanvasDocumentResourceEmbed({
  canvases,
  resourceId,
}: {
  canvases: CanvasPreviewSource
  resourceId: ResourceId
}) {
  const state = useContentSnapshot(canvases, resourceId)
  return state.status === 'ready' ? (
    <CanvasReadonlyPreview document={state.document} />
  ) : (
    <span className="p-3">Canvas unavailable</span>
  )
}

function CanvasEmbedFallback({ node }: { node: Extract<CanvasDocumentNode, { type: 'embed' }> }) {
  return (
    <span className="flex size-full items-center justify-center p-3 text-center">
      {canvasEmbedLabel(node)}
    </span>
  )
}

function useContentSnapshot<TState>(
  source: Readonly<{
    get(resourceId: ResourceId): TState
    subscribe(resourceId: ResourceId, listener: () => void): () => void
  }>,
  resourceId: ResourceId,
): TState {
  return useSyncExternalStore(
    (listener) => source.subscribe(resourceId, listener),
    () => source.get(resourceId),
    () => source.get(resourceId),
  )
}
