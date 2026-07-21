import { Folder, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { AuthoredDestination, CanonicalTarget } from '../authored-destination-contract'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceLoadResult,
  WorkspaceResourceIndexSnapshot,
} from '../resource-index-contract'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import type { WorkspaceSort } from '../workspace-preferences'
import type { WorkspaceSelection, WorkspaceSelectionAction } from '../workspace-selection'
import {
  allowWorkspaceResourceDrop,
  finishWorkspaceResourceDrop,
  leaveWorkspaceResourceDrop,
} from '../workspace-resource-drag'
import { useEnsureResourceCollection } from './resource-loading'
import { ResourceCreateMenu } from './resource-sidebar'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { resourceContextMenuRequest } from './resource-context-menu-request'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'
import { NoteSessionEditor } from '../../notes/note-session-editor'
import { CanvasEditor } from '../../canvas/canvas-editor'
import { CanvasResourceEmbed } from './canvas-resource-embed'
import { createWorkspaceAuthoredDestinationDropResolver } from './workspace-authored-destination-drop'
import { FileViewer } from '../../files/file-viewer'
import { MapViewer } from '../../maps/map-viewer'
import type { NoteHeadingNavigationRef } from '../../notes/note-heading-navigation'
import { useResourceStoreSnapshot } from './resource-store-snapshot'
import { renderEmbeddedNoteResource } from './embedded-note-resource-preview'
import { ResourceCard } from './resource-card'
import type { ContentRecovery, ContentRecoveryActionResult } from '../content-session-contract'

export function ResourceViewport({
  actions,
  canEdit,
  noteHeadingNavigation,
  onOpenContextMenu,
  onSelectionChange,
  resource,
  runtime,
  selection,
  snapshot,
  sort,
  target,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  noteHeadingNavigation: NoteHeadingNavigationRef
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  target: CanonicalTarget | null
}) {
  if (resource.lifecycle === 'trashed') {
    return (
      <ViewportState
        icon={resourceKindIcon(resource.kind)}
        title="This resource is in the trash"
        description="Restore it to continue working with its content."
      />
    )
  }
  if (resource.kind === 'folder') {
    return (
      <FolderViewport
        actions={actions}
        canEdit={canEdit}
        folder={resource}
        onOpenContextMenu={onOpenContextMenu}
        onSelectionChange={onSelectionChange}
        runtime={runtime}
        selection={selection}
        snapshot={snapshot}
        sort={sort}
      />
    )
  }
  switch (resource.kind) {
    case 'note':
      return (
        <NoteViewport
          actions={actions}
          canEdit={canEdit}
          headingNavigationRef={noteHeadingNavigation}
          resource={resource}
          runtime={runtime}
          target={target}
          onOpenContextMenu={onOpenContextMenu}
        />
      )
    case 'file':
      return <FileViewport canEdit={canEdit} resource={resource} runtime={runtime} />
    case 'map':
      return (
        <MapViewport
          canEdit={canEdit}
          resource={resource}
          runtime={runtime}
          snapshot={snapshot}
          target={target}
        />
      )
    case 'canvas':
      return (
        <CanvasViewport
          actions={actions}
          canEdit={canEdit}
          resource={resource}
          runtime={runtime}
          target={target}
        />
      )
  }
}

function MapViewport({
  canEdit,
  resource,
  runtime,
  snapshot,
  target,
}: {
  canEdit: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
  target: CanonicalTarget | null
}) {
  const state = useResourceStoreSnapshot(runtime.content.maps, resource.id)
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />
  return (
    <MapViewer
      canEdit={canEdit}
      focusedPinId={target?.kind === 'mapPin' ? target.pinId : null}
      mapResourceId={resource.id}
      openDestination={(destination) => openAuthoredDestination(runtime, destination)}
      resolveResource={(resourceId) => {
        const knowledge = snapshot.lookup(resourceId)
        return knowledge.state === 'known' ? knowledge.value : null
      }}
      session={state.session}
      title={resource.title}
    />
  )
}

function FileViewport({
  canEdit,
  resource,
  runtime,
}: {
  canEdit: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const source = runtime.content.files
  const state = useResourceStoreSnapshot(source, resource.id)
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />
  return (
    <FileViewer
      canEdit={canEdit}
      content={state.content}
      resourceId={resource.id}
      source={source}
      title={resource.title}
      version={state.version}
    />
  )
}

function CanvasViewport({
  actions,
  canEdit,
  resource,
  runtime,
  target,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: CanonicalTarget | null
}) {
  const state = useResourceStoreSnapshot(runtime.content.canvases, resource.id)
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />
  return (
    <CanvasEditor
      key={`${resource.id}:${state.session.document.guid}`}
      canEdit={canEdit}
      drop={createWorkspaceAuthoredDestinationDropResolver({
        actions,
      })}
      renderEmbed={({
        activation,
        editing,
        node,
        onDefaultTextColorChange,
        onMediaLayout,
        zoom,
      }) => (
        <CanvasResourceEmbed
          activation={activation}
          canEdit={canEdit}
          editing={editing}
          node={node}
          onDefaultTextColorChange={onDefaultTextColorChange}
          onMediaLayout={onMediaLayout}
          runtime={runtime}
          sourceResourceId={resource.id}
          zoom={zoom}
        />
      )}
      focusedNodeId={target?.kind === 'canvasNode' ? target.nodeId : null}
      openDestination={(destination) => openAuthoredDestination(runtime, destination)}
      resourceId={resource.id}
      session={state.session}
      title={resource.title}
    />
  )
}

function NoteViewport({
  actions,
  canEdit,
  headingNavigationRef,
  onOpenContextMenu,
  resource,
  runtime,
  target,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  headingNavigationRef: NoteHeadingNavigationRef
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: CanonicalTarget | null
}) {
  const source = runtime.content.notes
  const state = useResourceStoreSnapshot(source, resource.id)
  const focusedBlockId = target?.kind === 'noteBlock' ? target.blockId : null
  useEffect(() => {
    if (state.status !== 'initializing' && state.status !== 'ready') return
    if (focusedBlockId) headingNavigationRef.current?.(focusedBlockId)
  }, [focusedBlockId, headingNavigationRef, state.status])
  if (state.status !== 'initializing' && state.status !== 'ready') {
    return <ContentState resource={resource} state={state} />
  }
  return (
    <div
      className="flex min-h-0 flex-1"
      onContextMenu={(event) => onOpenContextMenu(resourceContextMenuRequest(event, resource))}
    >
      <NoteSessionEditor
        blockAccess={
          runtime.resources.noteBlockAccess.status === 'available' &&
          runtime.resources.access.status === 'available'
            ? {
                campaignId: runtime.scope.campaignId,
                gateway: runtime.resources.noteBlockAccess.value,
                noteId: resource.id,
                resourceAccess: runtime.resources.access.value,
              }
            : undefined
        }
        canEdit={canEdit}
        resources={{
          drop: createWorkspaceAuthoredDestinationDropResolver({
            actions,
          }),
          report: actions.report,
          renderNote: renderEmbeddedNoteResource,
          runtime,
          sourceResourceId: resource.id,
        }}
        headingNavigationRef={headingNavigationRef}
        label={`${resource.title} note editor`}
        scroll={{
          kind: 'persistent',
          campaignId: runtime.scope.campaignId,
          resourceId: resource.id,
        }}
        state={state}
      />
    </div>
  )
}

function FolderViewport({
  actions,
  canEdit,
  folder,
  onOpenContextMenu,
  onSelectionChange,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  folder: AuthorizedResourceSummary
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
}) {
  const query = { parentId: folder.id, lifecycle: 'active' as const }
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, folder.id)
  const load = useEnsureResourceCollection(runtime.resources.loader, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') {
    return (
      <FolderViewportSurface
        actions={actions}
        canEdit={canEdit}
        folderId={folder.id}
        folderTitle={folder.title}
      >
        <FolderLoadingState load={load} />
      </FolderViewportSurface>
    )
  }

  const resources = sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
  if (resources.length === 0 && collection.complete) {
    return (
      <FolderViewportSurface
        actions={actions}
        canEdit={canEdit}
        folderId={folder.id}
        folderTitle={folder.title}
      >
        {canEdit ? (
          <CreateNewDashboard actions={actions} creation={creation} folder={folder} />
        ) : (
          <ViewportState icon={Folder} title="This folder is empty" />
        )}
      </FolderViewportSurface>
    )
  }

  const ambiguous = duplicateResourceKeys(resources)
  const selectedIds = new Set(selection.selectedIds)
  const visibleIds = resources.map((resource) => resource.id)
  return (
    <FolderViewportSurface
      actions={actions}
      canEdit={canEdit}
      className="overflow-y-auto"
      folderId={folder.id}
      folderTitle={folder.title}
    >
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6">
        {resources.map((resource) => (
          <ResourceCard
            actions={actions}
            ambiguous={ambiguous.has(resourcePresentationKey(resource))}
            canEdit={canEdit}
            key={resource.id}
            resource={resource}
            selected={selectedIds.has(resource.id)}
            selection={selection}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
          />
        ))}
        {canEdit && (
          <ResourceCreateMenu
            actions={actions}
            label="Create item in this folder"
            parentId={folder.id}
            runtime={runtime}
            variant="card"
          />
        )}
      </div>
      {!collection.complete && (
        <button
          type="button"
          className="mx-6 mb-6 self-start text-sm underline"
          onClick={load.retry}
        >
          {load.result?.status === 'failed' ? 'Try loading resources again' : 'Load more resources'}
        </button>
      )}
    </FolderViewportSurface>
  )
}

function FolderViewportSurface({
  actions,
  canEdit,
  children,
  className = '',
  folderId,
  folderTitle,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  children: ReactNode
  className?: string
  folderId: AuthorizedResourceSummary['id']
  folderTitle: string
}) {
  return (
    <div
      aria-label={`${folderTitle} resource drop zone`}
      data-resource-id={folderId}
      data-workspace-drop-target="collection"
      className={`flex min-h-0 flex-1 flex-col data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-ring ${className}`}
      onDragOver={canEdit ? allowWorkspaceResourceDrop : undefined}
      onDragLeave={canEdit ? leaveWorkspaceResourceDrop : undefined}
      onDrop={
        canEdit
          ? (event) =>
              void finishWorkspaceResourceDrop(event, actions, {
                type: 'collection',
                parentId: folderId,
                title: folderTitle,
              })
          : undefined
      }
    >
      {children}
    </div>
  )
}

function CreateNewDashboard({
  actions,
  creation,
  folder,
}: {
  actions: WorkspaceActions
  creation: ReturnType<typeof useWorkspaceCreation>
  folder: AuthorizedResourceSummary
}) {
  const blocked = creation.blocked
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-1 text-center text-sm text-muted-foreground">{folder.title}</p>
        <h2 className="mb-6 text-center text-xl font-semibold">Create New</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['note', 'folder', 'map', 'canvas', 'file'] as const).map((kind) => {
            const Icon = resourceKindIcon(kind)
            const isPending = creation.pendingControlId === kind
            return (
              <button
                key={kind}
                type="button"
                aria-busy={isPending}
                disabled={blocked}
                className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium shadow-sm hover:bg-muted"
                onClick={async () => {
                  const title = `Untitled ${kind}`
                  await creation.run(kind, (signal) =>
                    actions.create(kind, folder.id, title, signal),
                  )
                }}
              >
                {isPending ? (
                  <Loader2 className="size-7 animate-spin text-muted-foreground" />
                ) : (
                  <Icon className="size-7 text-muted-foreground" />
                )}
                {resourceKindLabel(kind)}
              </button>
            )
          })}
        </div>
        <WorkspaceCreationStatus creation={creation} />
        <div className="mt-8 border-t border-border pt-5 text-center">
          <p className="text-sm font-medium">Create from Template</p>
          <p className="mt-1 text-sm text-muted-foreground">No templates yet</p>
        </div>
      </div>
    </div>
  )
}

function FolderLoadingState({
  load,
}: {
  load: { result: ResourceLoadResult | null; retry: () => void }
}) {
  if (load.result?.status === 'failed') {
    return (
      <ViewportState
        icon={Folder}
        title="Could not load this folder"
        action={
          load.result.retryable ? (
            <button type="button" className="mt-2 text-sm underline" onClick={load.retry}>
              Try again
            </button>
          ) : null
        }
      />
    )
  }
  return (
    <div aria-label="Loading folder" className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
      {[0, 1, 2, 3, 4].map((key) => (
        <div key={key} className="h-[140px] animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

type SessionState =
  | ReturnType<EditorRuntime['content']['notes']['get']>
  | ReturnType<EditorRuntime['content']['files']['get']>
  | ReturnType<EditorRuntime['content']['maps']['get']>
  | ReturnType<EditorRuntime['content']['canvases']['get']>

function ContentState({
  resource,
  state,
}: {
  resource: AuthorizedResourceSummary
  state: Exclude<SessionState, { status: 'ready' }>
}) {
  const Icon = resourceKindIcon(resource.kind)
  switch (state.status) {
    case 'loading':
      return <ViewportState icon={Icon} title="Loading content…" />
    case 'initializing':
      return <ViewportState icon={Icon} title="Preparing your note…" />
    case 'empty':
      return (
        <ViewportState
          icon={Icon}
          title="No visible content"
          description="No note blocks are visible in this view."
        />
      )
    case 'unavailable':
      return <ViewportState icon={Icon} title="Content unavailable" description={state.reason} />
    case 'recovery_required':
      return (
        <ViewportState
          icon={Icon}
          title="Unsaved edits need your attention"
          description="A restore replaced this item while you had unsaved edits. The restored item has not been changed."
          action={<ContentRecoveryActions recovery={state.recovery} resource={resource} />}
        />
      )
    case 'integrity_error':
      return (
        <ViewportState
          icon={Icon}
          title="Content could not be verified"
          description={state.issue}
        />
      )
  }
}

function ContentRecoveryActions({
  recovery,
  resource,
}: {
  recovery: ContentRecovery
  resource: AuthorizedResourceSummary
}) {
  const [pending, setPending] = useState<'discard' | 'reapply' | null>(null)
  const [result, setResult] = useState<ContentRecoveryActionResult | null>(null)
  const reapply = async () => {
    setPending('reapply')
    const next = await recovery.reapply()
    setResult(next)
    if (next.status !== 'completed') setPending(null)
  }
  const discard = () => {
    setPending('discard')
    const next = recovery.discard()
    setResult(next)
    if (next.status !== 'completed') setPending(null)
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          disabled={pending !== null}
          onClick={() => downloadRecovery(recovery, resource)}
        >
          Export edits
        </button>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          disabled={pending !== null}
          onClick={() => void reapply()}
        >
          {pending === 'reapply' ? 'Reapplying…' : 'Reapply edits'}
        </button>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-sm text-destructive"
          disabled={pending !== null}
          onClick={discard}
        >
          {pending === 'discard' ? 'Discarding…' : 'Discard edits'}
        </button>
      </div>
      {result?.status === 'rejected' && (
        <p className="mt-2 text-sm text-destructive">{result.reason}</p>
      )}
    </div>
  )
}

function downloadRecovery(recovery: ContentRecovery, resource: AuthorizedResourceSummary): void {
  const result = recovery.export()
  if (result.status !== 'ready') return
  const url = URL.createObjectURL(
    new Blob([Uint8Array.from(result.bytes).buffer], { type: result.mediaType }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `${resource.title} recovered edits.${result.extension}`
  link.click()
  URL.revokeObjectURL(url)
}

export function ViewportState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description?: string
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-6 text-center">
      <div>
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  )
}

function openAuthoredDestination(runtime: EditorRuntime, destination: AuthoredDestination) {
  if (destination.kind === 'internal') {
    runtime.navigation.open(destination.target)
    return
  }
  if (destination.kind === 'externalUrl') {
    window.open(destination.url, '_blank', 'noopener,noreferrer')
  }
}
