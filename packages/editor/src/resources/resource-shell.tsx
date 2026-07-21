import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { Menu, PanelLeftOpen } from 'lucide-react'
import type { ResourceId } from './domain-id'
import type { EditorRuntime } from './editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceKnowledge,
  ResourceLoadResult,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import { DEFAULT_WORKSPACE_PREFERENCES } from './workspace-preferences'
import type { WorkspacePreferencePatch } from './workspace-preferences'
import { EMPTY_WORKSPACE_SELECTION, updateWorkspaceSelection } from './workspace-selection'
import type { WorkspaceSelection, WorkspaceSelectionAction } from './workspace-selection'
import { EMPTY_WORKSPACE_CLIPBOARD } from './workspace-clipboard'
import type { WorkspaceClipboard } from './workspace-clipboard'
import { workspaceKeyboardCommand } from './workspace-keyboard'
import type { WorkspaceKeyboardCommand } from './workspace-keyboard'
import {
  clearWorkspaceResourceDropTargets,
  readWorkspaceResourceDrag,
} from './workspace-resource-drag'
import { planWorkspaceResourceDrop } from './workspace-resource-drop-plan'
import type { WorkspaceResourceDropTarget } from './workspace-resource-drop-plan'
import { useEnsureResource, useEnsureResourceCollection } from './workspace/resource-loading'
import { ResourceContextMenu } from './workspace/resource-context-menu'
import type { ResourceContextMenuRequest } from './workspace/resource-context-menu-request'
import { ResourceSidebar } from './workspace/resource-sidebar'
import { ResourceSidebarContextMenu } from './workspace/resource-sidebar-context-menu'
import { ResourceTopbar } from './workspace/resource-topbar'
import { WorkspaceResourceDragOverlay } from './workspace/workspace-resource-drag-overlay'
import type { WorkspaceResourceDragOverlayState } from './workspace/workspace-resource-drag-overlay'
import { ResourceViewport, ViewportState } from './workspace/resource-viewport'
import { ResourceRightSidebar } from './workspace/resource-right-sidebar'
import { ResourceSearchDialog } from './workspace/resource-search-dialog'
import { ResourceHistoryPreview } from './workspace/resource-history-preview'
import { useResourceSnapshot } from './workspace/use-resource-snapshot'
import { useWorkspacePanelGeometry } from './workspace/use-workspace-panel-geometry'
import { ResourceViewAsBanner } from './workspace/resource-view-as-banner'
import { ResizableWorkspacePanel } from './workspace/resizable-workspace-panel'
import type { ResourceRightSidebarPanel } from './workspace/resource-right-sidebar-panels'
import { resourceRightSidebarPanels } from './workspace/resource-right-sidebar-panels'
import { createWorkspaceActions } from './workspace/resource-operations'
import type {
  WorkspaceActions,
  WorkspaceFeedback,
  WorkspaceReport,
} from './workspace/resource-operations'
import type {
  NoteHeadingNavigation,
  NoteHeadingNavigationRef,
} from '../notes/note-heading-navigation'
import type { PlainTransferProgress } from './transfer-job-contract'

const EMPTY_BOOKMARK_IDS: ReadonlySet<ResourceId> = new Set()
const UNKNOWN_BOOKMARKS = { state: 'unknown' as const }
const ACTIVE_ROOT_QUERY = { parentId: null, lifecycle: 'active' as const }

type WorkspaceOverlay =
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'search' }>
  | Readonly<{ kind: 'move'; resourceIds: ReadonlyArray<ResourceId> }>
  | Readonly<{ kind: 'rootMenu'; x: number; y: number }>
  | Readonly<{
      kind: 'resourceMenu'
      request: ResourceContextMenuRequest
      resourceIds: ReadonlyArray<ResourceId>
    }>

type WorkspaceRename =
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'sidebar' | 'topbar'; resourceId: ResourceId }>

type SelectedResourceState =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{
      kind: 'loading'
      load: { result: ResourceLoadResult | null; retry: () => void }
    }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'ready'; resource: AuthorizedResourceSummary }>

export function ResourceShell({
  ariaLabel,
  runtime,
  resourcePanelSlots,
  showResourcePanel = true,
  workspaceName,
}: {
  ariaLabel: string
  runtime: EditorRuntime
  resourcePanelSlots?: Readonly<{
    footer?: ReactNode
    headerEnd?: ReactNode
    headerStart?: ReactNode
  }>
  showResourcePanel?: boolean
  workspaceName: string | null
}) {
  const snapshot = useResourceSnapshot(runtime)
  const rootCollection = snapshot.list(ACTIVE_ROOT_QUERY)
  const rootLoad = useEnsureResourceCollection(
    runtime.resources.loader,
    ACTIVE_ROOT_QUERY,
    rootCollection.state === 'unknown',
  )
  const selectedTarget = useResourceSelection(runtime)
  const selectedResourceId = selectedTarget?.resourceId ?? null
  const bookmarks = useResourceBookmarks(runtime)
  const preferencesState = useWorkspacePreferences(runtime)
  const preferences =
    preferencesState.status === 'ready' ? preferencesState.value : DEFAULT_WORKSPACE_PREFERENCES
  const { geometry: panelGeometry, setPanelSize: changePanelSize } = useWorkspacePanelGeometry(
    runtime.scope,
  )
  const selectedLoad = useEnsureResource(runtime, selectedResourceId)
  const selectedKnowledge: ResourceKnowledge<AuthorizedResourceSummary> = selectedResourceId
    ? snapshot.lookup(selectedResourceId)
    : { state: 'unknown' }
  const selected = selectedResourceState(selectedResourceId, selectedKnowledge, selectedLoad)
  const [sidebarView, setSidebarView] = useState<'bookmarks' | 'resources'>('resources')
  const [selection, setSelection] = useState(EMPTY_WORKSPACE_SELECTION)
  const [clipboard, setClipboard] = useState(EMPTY_WORKSPACE_CLIPBOARD)
  const resourceDrag = useWorkspaceResourceDragOverlay(snapshot, workspaceName ?? 'Resources')
  const [overlay, setOverlay] = useState<WorkspaceOverlay>({ kind: 'closed' })
  const [rename, setRename] = useState<WorkspaceRename>({ kind: 'closed' })
  const [notice, setNotice] = useState<WorkspaceFeedback | null>(null)
  const [rightPanel, setRightPanel] = useState<ResourceRightSidebarPanel>('details')
  const noteHeadingNavigation = useRef<NoteHeadingNavigation | null>(null)
  const report: WorkspaceReport = setNotice
  const actions = createWorkspaceActions(runtime, report)
  const leftVisible = showResourcePanel && preferences.panels.leftVisible
  const rightVisible = selected.kind === 'ready' && preferences.panels.rightVisible
  const canEditStructure =
    runtime.resources.structure.status === 'available' && preferences.mode === 'editor'
  const changeSelection = (action: WorkspaceSelectionAction) =>
    setSelection((current) => updateWorkspaceSelection(current, action))
  const changeSidebarView = (view: 'bookmarks' | 'resources') => {
    setSidebarView(view)
    changeSelection({ type: 'clear' })
  }
  const openContextMenu = (request: ResourceContextMenuRequest) => {
    const resourceIds = selection.selectedIds.includes(request.resource.id)
      ? selection.selectedIds
      : [request.resource.id]
    if (request.origin !== 'topbar') {
      changeSelection({ type: 'normalizeContext', resourceId: request.resource.id })
    }
    setOverlay({ kind: 'resourceMenu', request, resourceIds })
  }
  const closeOverlay = () => setOverlay({ kind: 'closed' })
  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) =>
    handleResourceShellKeyDown(event, {
      actions,
      canEditStructure,
      clipboard,
      searchAvailable: runtime.search.status === 'available',
      selectedResourceId,
      selection,
      snapshot,
      undoAvailable: runtime.resources.undo.status === 'available',
      onClipboardChange: setClipboard,
      onCloseContextMenu: closeOverlay,
      onSearch: () => setOverlay({ kind: 'search' }),
    })

  const patchPreference = (patch: WorkspacePreferencePatch) => {
    void runtime.preferences
      .patch(patch)
      .catch(() => report({ kind: 'failed', message: 'Could not save workspace preference' }))
  }
  const previousResourceId = useRef(selectedResourceId)
  useEffect(() => {
    if (previousResourceId.current === selectedResourceId) return
    previousResourceId.current = selectedResourceId
    if (preferences.panels.rightVisible) {
      void runtime.preferences.patch({ field: 'rightPanelVisible', value: false })
    }
  }, [preferences.panels.rightVisible, runtime.preferences, selectedResourceId])

  useEffect(() => {
    if (selectedResourceId && runtime.search.status === 'available') {
      runtime.search.value.recordOpened(selectedResourceId)
    }
  }, [runtime.search, selectedResourceId])

  if (rootCollection.state === 'unknown') {
    return (
      <WorkspaceReadinessBoundary
        ariaLabel={ariaLabel}
        load={rootLoad}
        viewAs={runtime.viewAs}
        onRetry={rootLoad.retry}
      />
    )
  }

  return (
    <section
      aria-label={ariaLabel}
      aria-busy="false"
      className="relative flex h-full min-h-0 overflow-hidden bg-background text-foreground"
      onDragEnd={resourceDrag.end}
      onDragEnterCapture={resourceDrag.updateEffect}
      onDragLeave={resourceDrag.leave}
      onDragOverCapture={resourceDrag.updateEffect}
      onDragStart={resourceDrag.begin}
      onDropCapture={resourceDrag.end}
      onKeyDown={handleWorkspaceKeyDown}
    >
      {leftVisible && (
        <ResizableWorkspacePanel
          panel="left"
          size={panelGeometry.left}
          onCommit={(size) => changePanelSize('left', size)}
          onClose={() => patchPreference({ field: 'leftPanelVisible', value: false })}
        >
          <ResourceSidebar
            actions={actions}
            canEdit={canEditStructure}
            bookmarks={bookmarks}
            view={sidebarView}
            runtime={runtime}
            renamingResourceId={rename.kind === 'sidebar' ? rename.resourceId : null}
            selectedResourceId={selectedResourceId}
            selection={selection}
            slots={resourcePanelSlots}
            snapshot={snapshot}
            sort={preferences.sort}
            workspaceName={workspaceName}
            onViewChange={changeSidebarView}
            onSearch={() => setOverlay({ kind: 'search' })}
            onClose={() => patchPreference({ field: 'leftPanelVisible', value: false })}
            onOpenBackgroundContextMenu={(position) => {
              setOverlay({ kind: 'rootMenu', ...position })
            }}
            onOpenContextMenu={openContextMenu}
            onRenamingResourceIdChange={(resourceId) =>
              setRename(resourceId ? { kind: 'sidebar', resourceId } : { kind: 'closed' })
            }
            onSelectionChange={changeSelection}
            onSortChange={(sort) => patchPreference({ field: 'sort', value: sort })}
          />
        </ResizableWorkspacePanel>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <SelectedResource
          actions={actions}
          canEditStructure={canEditStructure}
          state={selected}
          noteHeadingNavigation={noteHeadingNavigation}
          leftSidebarAvailable={showResourcePanel}
          leftSidebarVisible={leftVisible}
          mode={preferences.mode}
          topbarEditing={rename.kind === 'topbar' && rename.resourceId === selectedResourceId}
          topbarMenuOpen={
            overlay.kind === 'resourceMenu' &&
            overlay.request.origin === 'topbar' &&
            overlay.request.resource.id === selectedResourceId
          }
          runtime={runtime}
          selection={selection}
          snapshot={snapshot}
          sort={preferences.sort}
          target={selectedTarget}
          onModeChange={(mode) => patchPreference({ field: 'mode', value: mode })}
          onOpenHistory={() => {
            setRightPanel('history')
            patchPreference({ field: 'rightPanelVisible', value: true })
          }}
          onOpenLeftSidebar={() => patchPreference({ field: 'leftPanelVisible', value: true })}
          rightSidebarVisible={rightVisible}
          onToggleRightSidebar={() =>
            patchPreference({ field: 'rightPanelVisible', value: !rightVisible })
          }
          onOpenContextMenu={openContextMenu}
          onTopbarEditingChange={(editing) =>
            setRename(
              editing && selectedResourceId
                ? { kind: 'topbar', resourceId: selectedResourceId }
                : { kind: 'closed' },
            )
          }
          onTopbarMenuChange={(request) => (request ? openContextMenu(request) : closeOverlay())}
          onSelectionChange={changeSelection}
        />
      </div>
      {rightVisible && selected.kind === 'ready' && (
        <ResizableWorkspacePanel
          panel="right"
          size={panelGeometry.right}
          onCommit={(size) => changePanelSize('right', size)}
          onClose={() => patchPreference({ field: 'rightPanelVisible', value: false })}
        >
          <ResourceRightSidebar
            actions={actions}
            activePanel={rightPanel}
            noteHeadingNavigation={noteHeadingNavigation}
            resource={selected.resource}
            runtime={runtime}
            onActivePanelChange={setRightPanel}
          />
        </ResizableWorkspacePanel>
      )}
      <WorkspaceOverlayHost
        actions={actions}
        bookmarks={bookmarks}
        canEditStructure={canEditStructure}
        clipboard={clipboard}
        activeRightPanel={rightPanel}
        overlay={overlay}
        rightSidebarVisible={rightVisible}
        runtime={runtime}
        snapshot={snapshot}
        onClipboardChange={setClipboard}
        onClose={closeOverlay}
        onOpenRightPanel={(panel) => {
          setRightPanel(panel)
          patchPreference({ field: 'rightPanelVisible', value: true })
        }}
        onOverlayChange={setOverlay}
        onRenameChange={setRename}
      />
      <WorkspaceResourceDragOverlay
        nativePreviewRef={resourceDrag.nativePreviewRef}
        overlayRef={resourceDrag.overlayRef}
        state={resourceDrag.state}
      />
      <ResourceViewAsBanner viewAs={runtime.viewAs} />
      <WorkspaceNotice notice={notice} dismiss={setNotice} />
    </section>
  )
}

function WorkspaceOverlayHost({
  activeRightPanel,
  actions,
  bookmarks,
  canEditStructure,
  clipboard,
  overlay,
  rightSidebarVisible,
  runtime,
  snapshot,
  onClipboardChange,
  onClose,
  onOpenRightPanel,
  onOverlayChange,
  onRenameChange,
}: {
  activeRightPanel: ResourceRightSidebarPanel
  actions: WorkspaceActions
  bookmarks: ResourceKnowledge<ReadonlySet<ResourceId>>
  canEditStructure: boolean
  clipboard: WorkspaceClipboard
  overlay: WorkspaceOverlay
  rightSidebarVisible: boolean
  runtime: EditorRuntime
  snapshot: WorkspaceResourceIndexSnapshot
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  onClose: () => void
  onOpenRightPanel: (panel: ResourceRightSidebarPanel) => void
  onOverlayChange: (overlay: WorkspaceOverlay) => void
  onRenameChange: (rename: WorkspaceRename) => void
}) {
  const menu = overlay.kind === 'resourceMenu' ? overlay : null
  const currentRequest = menu ? currentResourceContextRequest(snapshot, menu.request) : null
  return (
    <>
      {runtime.search.status === 'available' &&
        (overlay.kind === 'search' || overlay.kind === 'move') && (
          <ResourceSearchDialog
            actions={actions}
            canEdit={canEditStructure}
            open
            purpose={
              overlay.kind === 'move'
                ? { type: 'move', resourceIds: overlay.resourceIds }
                : { type: 'open' }
            }
            runtime={runtime}
            onOpenChange={(open) => {
              if (!open) onClose()
            }}
          />
        )}
      {menu && currentRequest && menu.request.origin !== 'topbar' && (
        <ResourceContextMenu
          actions={actions}
          bookmarksAvailable={runtime.resources.bookmarks.status === 'available'}
          campaignId={runtime.scope.campaignId}
          canEdit={canEditStructure}
          clipboard={clipboard}
          navigation={runtime.navigation}
          request={currentRequest}
          resourceIds={menu.resourceIds}
          runtime={runtime}
          surface="resource"
          bookmarkedIds={bookmarks.state === 'known' ? bookmarks.value : EMPTY_BOOKMARK_IDS}
          onClipboardChange={onClipboardChange}
          onClose={onClose}
          onRequestMove={(resourceIds) => onOverlayChange({ kind: 'move', resourceIds })}
          onRequestRename={() =>
            onRenameChange({ kind: 'sidebar', resourceId: menu.request.resource.id })
          }
        />
      )}
      {menu && currentRequest && menu.request.origin === 'topbar' && (
        <ResourceContextMenu
          actions={actions}
          activePanel={activeRightPanel}
          canEdit={canEditStructure}
          panels={resourceRightSidebarPanels(currentRequest.resource, runtime)}
          request={currentRequest}
          rightSidebarVisible={rightSidebarVisible}
          runtime={runtime}
          surface="topbar"
          onClose={onClose}
          onOpenPanel={onOpenRightPanel}
          onRequestMove={(resourceIds) => onOverlayChange({ kind: 'move', resourceIds })}
          onRequestRename={() =>
            onRenameChange({ kind: 'topbar', resourceId: menu.request.resource.id })
          }
        />
      )}
      {overlay.kind === 'rootMenu' && (
        <ResourceSidebarContextMenu
          actions={actions}
          clipboard={clipboard}
          runtime={runtime}
          x={overlay.x}
          y={overlay.y}
          onClipboardChange={onClipboardChange}
          onClose={onClose}
        />
      )}
    </>
  )
}

function handleResourceShellKeyDown(
  event: KeyboardEvent<HTMLElement>,
  input: Readonly<{
    actions: WorkspaceActions
    canEditStructure: boolean
    clipboard: WorkspaceClipboard
    searchAvailable: boolean
    selectedResourceId: ResourceId | null
    selection: WorkspaceSelection
    snapshot: WorkspaceResourceIndexSnapshot
    undoAvailable: boolean
    onClipboardChange: (clipboard: WorkspaceClipboard) => void
    onCloseContextMenu: () => void
    onSearch: () => void
  }>,
): void {
  if (event.defaultPrevented) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
    if (input.searchAvailable) {
      event.preventDefault()
      input.onSearch()
    }
    return
  }
  const command = workspaceKeyboardCommand(event)
  if (!command) return
  if (command === 'undo' || command === 'redo') {
    runUndoShortcut(command, event, input.actions, input.undoAvailable)
    return
  }
  if (!input.canEditStructure) return
  runResourceShortcut({
    actions: input.actions,
    clipboard: input.clipboard,
    command,
    focusedId: input.selection.focusedId ?? input.selectedResourceId,
    resourceIds: resourceShellCommandIds(input.selection, input.selectedResourceId),
    snapshot: input.snapshot,
    onClipboardChange: input.onClipboardChange,
    onCloseContextMenu: input.onCloseContextMenu,
    onPreventDefault: () => event.preventDefault(),
  })
}

function resourceShellCommandIds(
  selection: WorkspaceSelection,
  selectedResourceId: ResourceId | null,
): ReadonlyArray<ResourceId> {
  if (selection.selectedIds.length > 0) return selection.selectedIds
  return selectedResourceId ? [selectedResourceId] : []
}

function currentResourceContextRequest(
  snapshot: WorkspaceResourceIndexSnapshot,
  request: ResourceContextMenuRequest,
): ResourceContextMenuRequest {
  const current = snapshot.lookup(request.resource.id)
  return current.state === 'known' ? { ...request, resource: current.value } : request
}

function WorkspaceNotice({
  dismiss,
  notice,
}: {
  dismiss: (notice: null) => void
  notice: WorkspaceFeedback | null
}) {
  useEffect(() => {
    if (!notice || notice.kind === 'pending') return
    const timeout = window.setTimeout(
      () => dismiss(null),
      notice.kind === 'failed' && notice.retry ? 6_000 : 3_000,
    )
    return () => window.clearTimeout(timeout)
  }, [dismiss, notice])
  if (!notice) return null
  return (
    <div
      role="status"
      className="absolute bottom-3 left-1/2 z-50 min-w-72 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{notice.message}</span>
        {notice.kind === 'failed' && notice.retry && (
          <button type="button" className="font-medium underline" onClick={notice.retry}>
            Retry
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss notification"
          className="text-muted-foreground"
          onClick={() => dismiss(null)}
        >
          ×
        </button>
      </div>
      {notice.kind === 'pending' && notice.progress && (
        <WorkspaceTransferProgress progress={notice.progress} />
      )}
    </div>
  )
}

function useWorkspaceResourceDragOverlay(
  snapshot: WorkspaceResourceIndexSnapshot,
  workspaceName: string,
) {
  const [state, setState] = useState<WorkspaceResourceDragOverlayState>(null)
  const nativePreviewRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastFeedbackKey = useRef<string | null>(null)
  useEffect(() => {
    const position = (event: globalThis.DragEvent) => {
      if (!dragging.current || (event.clientX === 0 && event.clientY === 0)) return
      positionWorkspaceDragOverlay(overlayRef.current, event.clientX, event.clientY)
    }
    document.addEventListener('dragover', position, true)
    return () => document.removeEventListener('dragover', position, true)
  }, [])
  const begin = (event: DragEvent<HTMLElement>) => {
    const drag = readWorkspaceResourceDrag(event.dataTransfer)
    if (!drag) return
    const targetResourceId =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-resource-id]')?.dataset.resourceId
        : undefined
    const sourceId =
      drag.resourceIds.find((resourceId) => resourceId === targetResourceId) ?? drag.resourceIds[0]
    const source = sourceId ? snapshot.lookup(sourceId) : null
    if (!source || source.state !== 'known') return
    if (nativePreviewRef.current) {
      event.dataTransfer.setDragImage(nativePreviewRef.current, 0, 0)
    }
    dragging.current = true
    showWorkspaceDragOverlay(overlayRef.current, event.clientX, event.clientY)
    lastFeedbackKey.current = null
    setState({
      count: drag.resourceIds.length,
      feedback: null,
      resource: source.value,
    })
  }
  const updateEffect = (event: DragEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null
    const copy = event.altKey || event.ctrlKey || event.metaKey
    queueMicrotask(() => {
      const activeTarget = target?.closest<HTMLElement>('[data-drop-target=true]') ?? null
      const destination = workspaceDropTarget(activeTarget, snapshot, workspaceName)
      const drag = readWorkspaceResourceDrag(event.dataTransfer)
      const plan =
        drag && destination ? planWorkspaceResourceDrop(snapshot, drag, destination, copy) : null
      const feedback = activeTarget?.dataset.dropFeedback
        ? {
            blocked: activeTarget.dataset.dropBlocked === 'true',
            label: activeTarget.dataset.dropFeedback,
          }
        : plan
          ? {
              blocked: plan.status === 'rejected',
              label: plan.label,
            }
          : { blocked: true, label: 'Cannot drop here' }
      const feedbackKey = `${feedback.blocked}:${feedback.label}`
      if (lastFeedbackKey.current === feedbackKey) return
      lastFeedbackKey.current = feedbackKey
      setState((current) => {
        if (!current) return null
        return { ...current, feedback }
      })
    })
  }
  const end = (event: DragEvent<HTMLElement>) => {
    clearWorkspaceResourceDropTargets(event.currentTarget)
    dragging.current = false
    if (overlayRef.current) {
      overlayRef.current.classList.add('hidden')
      overlayRef.current.style.willChange = ''
    }
    lastFeedbackKey.current = null
    setState(null)
  }
  return {
    begin,
    end,
    leave: clearWorkspaceResourceDropTargetsAfterLeave,
    nativePreviewRef,
    overlayRef,
    state,
    updateEffect,
  }
}

function workspaceDropTarget(
  element: HTMLElement | null,
  snapshot: WorkspaceResourceIndexSnapshot,
  workspaceName: string,
): WorkspaceResourceDropTarget | null {
  if (!element) return null
  if (element.dataset.workspaceDropTarget === 'trash') return { type: 'trash' }
  if (element.dataset.workspaceDropTarget !== 'collection') return null
  const resourceId = (element.dataset.workspaceDropResourceId ?? element.dataset.resourceId) as
    | ResourceId
    | undefined
  if (!resourceId) return { type: 'collection', parentId: null, title: workspaceName }
  const resource = snapshot.lookup(resourceId)
  return resource.state === 'known' && resource.value.kind === 'folder'
    ? {
        type: 'collection',
        parentId: resource.value.id,
        title: resource.value.title,
      }
    : null
}

function showWorkspaceDragOverlay(element: HTMLDivElement | null, x: number, y: number) {
  if (!element) return
  element.style.willChange = 'transform'
  element.classList.remove('hidden')
  positionWorkspaceDragOverlay(element, x, y)
}

function positionWorkspaceDragOverlay(element: HTMLDivElement | null, x: number, y: number) {
  if (element) element.style.transform = `translate3d(${x + 8}px, ${y + 8}px, 0)`
}

function clearWorkspaceResourceDropTargetsAfterLeave(event: DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
  clearWorkspaceResourceDropTargets(event.currentTarget)
}

function WorkspaceTransferProgress({ progress }: { progress: PlainTransferProgress }) {
  const useBytes = progress.totalBytes > 0
  const value = useBytes ? progress.uploadedBytes : progress.completedEntries
  const maximum = useBytes ? progress.totalBytes : progress.totalEntries
  return (
    <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
      <progress
        aria-label="Import progress"
        className="h-1.5 w-full accent-primary"
        max={Math.max(1, maximum)}
        value={Math.min(value, maximum)}
      />
      <p>
        {progress.completedEntries}/{progress.totalEntries} resources
      </p>
    </div>
  )
}

function WorkspaceReadinessBoundary({
  ariaLabel,
  load,
  onRetry,
  viewAs,
}: {
  ariaLabel: string
  load: ReturnType<typeof useEnsureResourceCollection>
  onRetry: () => void
  viewAs: EditorRuntime['viewAs']
}) {
  const result = load.result
  const failed = result !== null && result.status !== 'completed'
  return (
    <section
      aria-label={ariaLabel}
      aria-busy={failed ? 'false' : 'true'}
      className="relative flex h-full min-h-0 items-center justify-center bg-background text-foreground"
    >
      {failed ? (
        <div role="alert" className="space-y-2 text-center">
          <p>Could not load workspace: {workspaceLoadFailureMessage(result)}</p>
          <button type="button" className="text-sm font-medium underline" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        <p role="status">Loading workspace…</p>
      )}
      <ResourceViewAsBanner viewAs={viewAs} />
    </section>
  )
}

function workspaceLoadFailureMessage(result: Exclude<ResourceLoadResult, { status: 'completed' }>) {
  switch (result.status) {
    case 'failed':
      return result.reason
    case 'scope_changed':
      return 'scope changed'
    case 'unavailable':
      return result.reason
  }
}

function runUndoShortcut(
  command: Extract<WorkspaceKeyboardCommand, 'redo' | 'undo'>,
  event: KeyboardEvent<HTMLElement>,
  actions: WorkspaceActions,
  available: boolean,
): void {
  if (available) {
    event.preventDefault()
    void actions.undo(command)
  }
}

function runResourceShortcut({
  actions,
  clipboard,
  command,
  focusedId,
  onClipboardChange,
  onCloseContextMenu,
  onPreventDefault,
  resourceIds,
  snapshot,
}: Readonly<{
  actions: WorkspaceActions
  clipboard: WorkspaceClipboard
  command: Exclude<WorkspaceKeyboardCommand, 'redo' | 'undo'>
  focusedId: ResourceId | null
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  onCloseContextMenu: () => void
  onPreventDefault: () => void
  resourceIds: ReadonlyArray<ResourceId>
  snapshot: WorkspaceResourceIndexSnapshot
}>): void {
  if (!focusedId || resourceIds.length === 0) return
  const target = snapshot.lookup(focusedId)
  if (target.state !== 'known') return
  onPreventDefault()
  onCloseContextMenu()
  const setClipboard = (operation: 'copy' | 'move') =>
    onClipboardChange({ status: 'ready', operation, resourceIds })
  switch (command) {
    case 'copy':
      setClipboard('copy')
      return
    case 'cut':
      setClipboard('move')
      return
    case 'duplicate':
      void actions.duplicate(resourceIds, target.value.displayParentId)
      return
    case 'paste':
      if (target.value.kind === 'folder' && target.value.lifecycle === 'active') {
        void actions.paste(clipboard, target.value.id).then(onClipboardChange)
      }
      return
    case 'trash':
      if (target.value.lifecycle === 'active') {
        void actions.changeLifecycle(resourceIds, 'trash')
      }
  }
}

function selectedResourceState(
  resourceId: ResourceId | null,
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>,
  load: { result: ResourceLoadResult | null; retry: () => void },
): SelectedResourceState {
  if (resourceId === null) return { kind: 'empty' }
  if (knowledge.state === 'unknown') return { kind: 'loading', load }
  if (knowledge.state === 'missing') return { kind: 'missing' }
  return { kind: 'ready', resource: knowledge.value }
}

function SelectedResource({
  actions,
  canEditStructure,
  noteHeadingNavigation,
  leftSidebarAvailable,
  leftSidebarVisible,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenContextMenu,
  onOpenLeftSidebar,
  onToggleRightSidebar,
  onSelectionChange,
  rightSidebarVisible,
  runtime,
  selection,
  snapshot,
  state,
  sort,
  target,
  topbarEditing,
  topbarMenuOpen,
  onTopbarEditingChange,
  onTopbarMenuChange,
}: {
  actions: WorkspaceActions
  canEditStructure: boolean
  noteHeadingNavigation: NoteHeadingNavigationRef
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onOpenHistory: () => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onOpenLeftSidebar: () => void
  onToggleRightSidebar: () => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  rightSidebarVisible: boolean
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  state: SelectedResourceState
  sort: typeof DEFAULT_WORKSPACE_PREFERENCES.sort
  target: ReturnType<EditorRuntime['navigation']['current']>
  topbarEditing: boolean
  topbarMenuOpen: boolean
  onTopbarEditingChange: (editing: boolean) => void
  onTopbarMenuChange: (request: ResourceContextMenuRequest | null) => void
}) {
  if (state.kind === 'empty') {
    return (
      <EmptyResourceState
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  if (state.kind === 'loading') {
    return (
      <ResourceLoadingState
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        load={state.load}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  if (state.kind === 'missing') {
    return (
      <EmptyResourceState
        label="Resource not found"
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  const resource = state.resource
  const canEditContent =
    mode === 'editor' &&
    runtime.scope.projection !== 'view_as_player' &&
    resource.permission === 'edit'
  const canEditViewport = resource.kind === 'folder' ? canEditStructure : canEditContent
  const viewport = (
    <ResourceViewport
      actions={actions}
      canEdit={canEditViewport}
      noteHeadingNavigation={noteHeadingNavigation}
      resource={resource}
      runtime={runtime}
      selection={selection}
      snapshot={snapshot}
      sort={sort}
      target={target}
      onOpenContextMenu={onOpenContextMenu}
      onSelectionChange={onSelectionChange}
    />
  )
  return (
    <>
      <ResourceTopbar
        actions={actions}
        canEdit={canEditStructure}
        editing={topbarEditing}
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        menuOpen={topbarMenuOpen}
        mode={mode}
        resource={resource}
        runtime={runtime}
        onModeChange={onModeChange}
        onOpenHistory={onOpenHistory}
        onOpenLeftSidebar={onOpenLeftSidebar}
        onToggleRightSidebar={onToggleRightSidebar}
        onEditingChange={onTopbarEditingChange}
        onMenuChange={onTopbarMenuChange}
        rightSidebarVisible={rightSidebarVisible}
      />
      {!canEditViewport && (
        <div className="shrink-0 border-b border-border bg-muted/50 px-3 py-1 text-center text-xs text-muted-foreground">
          {mode === 'viewer' ? 'Viewing as yourself — editing is disabled' : 'Read only'}
        </div>
      )}
      {runtime.history.status === 'available' && resource.permission === 'edit' ? (
        <ResourceHistoryPreview
          actions={actions}
          resource={resource}
          runtime={runtime}
          source={runtime.history.value}
        >
          {viewport}
        </ResourceHistoryPreview>
      ) : (
        viewport
      )}
    </>
  )
}

function ResourceLoadingState({
  leftSidebarAvailable,
  leftSidebarVisible,
  load,
  onOpenLeftSidebar,
}: {
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  load: { result: ResourceLoadResult | null; retry: () => void }
  onOpenLeftSidebar: () => void
}) {
  const result = load.result
  let label = 'Loading resource…'
  let retry = false
  if (result?.status === 'failed') {
    label = result.retryable ? 'Could not load resource' : 'Resource unavailable'
    retry = result.retryable
  } else if (result?.status === 'unavailable') {
    label = 'Resource unavailable'
  } else if (result?.status === 'scope_changed') {
    label = 'Workspace changed'
  }
  return (
    <>
      <EmptyTopbar
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
      <ViewportState
        icon={Menu}
        title={label}
        action={
          retry ? (
            <button type="button" className="mt-2 text-sm underline" onClick={load.retry}>
              Try again
            </button>
          ) : null
        }
      />
    </>
  )
}

function EmptyResourceState({
  label = 'Select a resource',
  leftSidebarAvailable,
  leftSidebarVisible,
  onOpenLeftSidebar,
}: {
  label?: string
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  onOpenLeftSidebar: () => void
}) {
  return (
    <>
      <EmptyTopbar
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
      <ViewportState icon={Menu} title={label} />
    </>
  )
}

function EmptyTopbar({
  leftSidebarAvailable,
  leftSidebarVisible,
  onOpenLeftSidebar,
}: {
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  onOpenLeftSidebar: () => void
}) {
  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border px-1">
      {leftSidebarAvailable && !leftSidebarVisible && (
        <button
          type="button"
          aria-label="Open sidebar"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          onClick={onOpenLeftSidebar}
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
    </div>
  )
}

function useResourceSelection(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.navigation.subscribe(listener),
    () => runtime.navigation.current(),
    () => runtime.navigation.current(),
  )
}

function useWorkspacePreferences(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.preferences.subscribe(listener),
    () => runtime.preferences.get(),
    () => runtime.preferences.get(),
  )
}

function useResourceBookmarks(runtime: EditorRuntime) {
  const bookmarks = runtime.resources.bookmarks
  return useSyncExternalStore(
    (listener) =>
      bookmarks.status === 'available' ? bookmarks.value.subscribe(listener) : () => {},
    () => (bookmarks.status === 'available' ? bookmarks.value.get() : UNKNOWN_BOOKMARKS),
    () => (bookmarks.status === 'available' ? bookmarks.value.get() : UNKNOWN_BOOKMARKS),
  )
}
