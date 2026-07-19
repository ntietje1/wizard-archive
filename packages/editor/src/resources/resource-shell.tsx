import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { Menu } from 'lucide-react'
import type { ResourceId } from './domain-id'
import type { EditorRuntime } from './editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceKnowledge,
  ResourceLoadResult,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import { DEFAULT_WORKSPACE_PREFERENCES } from './workspace-preferences'
import type { WorkspacePanelPreference, WorkspacePreferenceChange } from './workspace-preferences'
import { EMPTY_WORKSPACE_SELECTION, updateWorkspaceSelection } from './workspace-selection'
import type { WorkspaceSelection, WorkspaceSelectionAction } from './workspace-selection'
import { EMPTY_WORKSPACE_CLIPBOARD } from './workspace-clipboard'
import type { WorkspaceClipboard } from './workspace-clipboard'
import { workspaceKeyboardCommand } from './workspace-keyboard'
import type { WorkspaceKeyboardCommand } from './workspace-keyboard'
import { useEnsureResource, useEnsureResourceCollection } from './workspace/resource-loading'
import { ResourceContextMenu } from './workspace/resource-context-menu'
import type { ResourceContextMenuRequest } from './workspace/resource-context-menu-request'
import { ResourceMoveDialog } from './workspace/resource-move-dialog'
import { ResourceSidebar } from './workspace/resource-sidebar'
import { ResourceTopbar } from './workspace/resource-topbar'
import { ResourceViewport, ViewportState } from './workspace/resource-viewport'
import { ResourceRightSidebar } from './workspace/resource-right-sidebar'
import { ResourceSearchDialog } from './workspace/resource-search-dialog'
import { ResourceHistoryPreview } from './workspace/resource-history-preview'
import { useResourceSnapshot } from './workspace/use-resource-snapshot'
import { ResourceViewAsBanner } from './workspace/resource-view-as-banner'
import type { ResourceRightSidebarPanel } from './workspace/resource-right-sidebar'
import { createWorkspaceActions } from './workspace/resource-operations'
import type { WorkspaceActions, WorkspaceReport } from './workspace/resource-operations'
import type {
  NoteHeadingNavigation,
  NoteHeadingNavigationRef,
} from '../notes/note-heading-navigation'
import type { PlainTransferProgress } from './transfer-job-contract'

const EMPTY_BOOKMARK_IDS: ReadonlySet<ResourceId> = new Set()
const UNKNOWN_BOOKMARKS = { state: 'unknown' as const }
const ACTIVE_ROOT_QUERY = { parentId: null, lifecycle: 'active' as const }

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
    preferencesState.status === 'ready'
      ? preferencesState.snapshot.value
      : DEFAULT_WORKSPACE_PREFERENCES
  const selectedLoad = useEnsureResource(runtime, selectedResourceId)
  const selected: ResourceKnowledge<AuthorizedResourceSummary> = selectedResourceId
    ? snapshot.lookup(selectedResourceId)
    : { state: 'unknown' }
  const [sidebarView, setSidebarView] = useState<'bookmarks' | 'resources' | 'trash'>('resources')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selection, setSelection] = useState(EMPTY_WORKSPACE_SELECTION)
  const [clipboard, setClipboard] = useState(EMPTY_WORKSPACE_CLIPBOARD)
  const [moveResourceIds, setMoveResourceIds] = useState<ReadonlyArray<ResourceId> | null>(null)
  const [contextMenu, setContextMenu] = useState<
    | Readonly<{ status: 'closed' }>
    | Readonly<{
        status: 'open'
        request: ResourceContextMenuRequest
        resourceIds: ReadonlyArray<ResourceId>
      }>
  >({ status: 'closed' })
  const [notice, setNotice] = useState<{
    message: string
    retry?: () => void
    progress?: PlainTransferProgress
  } | null>(null)
  const [rightPanel, setRightPanel] = useState<ResourceRightSidebarPanel>('details')
  const noteHeadingNavigation = useRef<NoteHeadingNavigation | null>(null)
  const report: WorkspaceReport = (message, retry, progress) =>
    setNotice({
      message,
      ...(retry ? { retry } : {}),
      ...(progress ? { progress } : {}),
    })
  const actions = createWorkspaceActions(runtime, report)
  const leftVisible = showResourcePanel && preferences.panels.left.visible
  const rightVisible = selected.state === 'known' && preferences.panels.right.visible
  const canEditStructure =
    runtime.resources.structure.status === 'available' && preferences.mode === 'editor'
  const changeSelection = (action: WorkspaceSelectionAction) =>
    setSelection((current) => updateWorkspaceSelection(current, action))
  const changeSidebarView = (view: 'bookmarks' | 'resources' | 'trash') => {
    setSidebarView(view)
    changeSelection({ type: 'clear' })
  }
  const openContextMenu = (request: ResourceContextMenuRequest) => {
    const resourceIds = selection.selectedIds.includes(request.resource.id)
      ? selection.selectedIds
      : [request.resource.id]
    changeSelection({ type: 'normalizeContext', resourceId: request.resource.id })
    setContextMenu({ status: 'open', request, resourceIds })
  }
  const closeContextMenu = () => setContextMenu({ status: 'closed' })
  const handleWorkspaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
      if (runtime.search.status === 'available') {
        event.preventDefault()
        setSearchOpen(true)
      }
      return
    }
    const command = workspaceKeyboardCommand(event)
    if (!command) return
    if (command === 'undo' || command === 'redo') {
      runUndoShortcut(command, event, actions, runtime.resources.undo.status === 'available')
      return
    }
    if (!canEditStructure) return
    runResourceShortcut({
      actions,
      clipboard,
      command,
      focusedId: selection.focusedId ?? selectedResourceId,
      resourceIds:
        selection.selectedIds.length > 0
          ? selection.selectedIds
          : selectedResourceId
            ? [selectedResourceId]
            : [],
      snapshot,
      onClipboardChange: setClipboard,
      onCloseContextMenu: closeContextMenu,
      onPreventDefault: () => event.preventDefault(),
    })
  }

  const changePreference = (change: WorkspacePreferenceChange) => {
    void runtime.preferences.change(change).then((result) => {
      if (result.status === 'failed') report('Could not save workspace preference')
    })
  }

  const previousResourceId = useRef(selectedResourceId)
  useEffect(() => {
    if (previousResourceId.current === selectedResourceId) return
    previousResourceId.current = selectedResourceId
    if (preferences.panels.right.visible) {
      void runtime.preferences.change({ type: 'panel', panel: 'right', visible: false })
    }
  }, [preferences.panels.right.visible, runtime.preferences, selectedResourceId])

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
      onKeyDown={handleWorkspaceKeyDown}
    >
      {leftVisible && (
        <ResizableWorkspacePanel
          panel="left"
          preference={preferences.panels.left}
          onCommit={(size) => changePreference({ type: 'panel', panel: 'left', size })}
        >
          <ResourceSidebar
            actions={actions}
            canEdit={canEditStructure}
            bookmarks={bookmarks}
            view={sidebarView}
            runtime={runtime}
            selectedResourceId={selectedResourceId}
            selection={selection}
            slots={resourcePanelSlots}
            snapshot={snapshot}
            sort={preferences.sort}
            workspaceName={workspaceName}
            onViewChange={changeSidebarView}
            onSearch={() => setSearchOpen(true)}
            onClose={() => changePreference({ type: 'panel', panel: 'left', visible: false })}
            onOpenContextMenu={openContextMenu}
            onSelectionChange={changeSelection}
            onSortChange={(sort) => changePreference({ type: 'sort', sort })}
          />
        </ResizableWorkspacePanel>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <SelectedResource
          actions={actions}
          canEditStructure={canEditStructure}
          knowledge={selected}
          noteHeadingNavigation={noteHeadingNavigation}
          leftSidebarAvailable={showResourcePanel}
          leftSidebarVisible={leftVisible}
          load={selectedLoad}
          mode={preferences.mode}
          resourceId={selectedResourceId}
          runtime={runtime}
          selection={selection}
          snapshot={snapshot}
          sort={preferences.sort}
          target={selectedTarget}
          onModeChange={(mode) => changePreference({ type: 'mode', mode })}
          onOpenHistory={() => {
            setRightPanel('history')
            changePreference({ type: 'panel', panel: 'right', visible: true })
          }}
          onOpenLeftSidebar={() =>
            changePreference({ type: 'panel', panel: 'left', visible: true })
          }
          onOpenRightSidebar={() =>
            changePreference({ type: 'panel', panel: 'right', visible: true })
          }
          onOpenContextMenu={openContextMenu}
          onSelectionChange={changeSelection}
        />
      </div>
      {rightVisible && (
        <ResizableWorkspacePanel
          panel="right"
          preference={preferences.panels.right}
          onCommit={(size) => changePreference({ type: 'panel', panel: 'right', size })}
        >
          <ResourceRightSidebar
            actions={actions}
            activePanel={rightPanel}
            noteHeadingNavigation={noteHeadingNavigation}
            resource={selected.value}
            runtime={runtime}
            onActivePanelChange={setRightPanel}
            onClose={() => changePreference({ type: 'panel', panel: 'right', visible: false })}
          />
        </ResizableWorkspacePanel>
      )}
      {runtime.search.status === 'available' && (
        <ResourceSearchDialog
          actions={actions}
          canEdit={canEditStructure}
          open={searchOpen}
          runtime={runtime}
          onOpenChange={setSearchOpen}
        />
      )}
      {contextMenu.status === 'open' && (
        <ResourceContextMenu
          actions={actions}
          bookmarksAvailable={runtime.resources.bookmarks.status === 'available'}
          campaignId={runtime.scope.campaignId}
          canEdit={canEditStructure}
          clipboard={clipboard}
          navigation={runtime.navigation}
          request={contextMenu.request}
          resourceIds={contextMenu.resourceIds}
          bookmarkedIds={bookmarks.state === 'known' ? bookmarks.value : EMPTY_BOOKMARK_IDS}
          onClipboardChange={setClipboard}
          onClose={closeContextMenu}
          onRequestMove={setMoveResourceIds}
        />
      )}
      {moveResourceIds && (
        <ResourceMoveDialog
          actions={actions}
          resourceIds={moveResourceIds}
          runtime={runtime}
          snapshot={snapshot}
          onClose={() => setMoveResourceIds(null)}
        />
      )}
      <ResourceViewAsBanner viewAs={runtime.viewAs} />
      {notice && (
        <div
          role="status"
          className="absolute bottom-3 left-1/2 z-50 min-w-72 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{notice.message}</span>
            {notice.retry && (
              <button type="button" className="font-medium underline" onClick={notice.retry}>
                Retry
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss notification"
              className="text-muted-foreground"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
          {notice.progress && <WorkspaceTransferProgress progress={notice.progress} />}
        </div>
      )}
    </section>
  )
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

function SelectedResource({
  actions,
  canEditStructure,
  knowledge,
  noteHeadingNavigation,
  leftSidebarAvailable,
  leftSidebarVisible,
  load,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenContextMenu,
  onOpenLeftSidebar,
  onOpenRightSidebar,
  onSelectionChange,
  resourceId,
  runtime,
  selection,
  snapshot,
  sort,
  target,
}: {
  actions: WorkspaceActions
  canEditStructure: boolean
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>
  noteHeadingNavigation: NoteHeadingNavigationRef
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  load: { result: ResourceLoadResult | null; retry: () => void }
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onOpenHistory: () => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onOpenLeftSidebar: () => void
  onOpenRightSidebar: () => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resourceId: ResourceId | null
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: typeof DEFAULT_WORKSPACE_PREFERENCES.sort
  target: ReturnType<EditorRuntime['navigation']['current']>
}) {
  if (!resourceId) {
    return (
      <EmptyResourceState
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  if (knowledge.state === 'unknown') {
    return (
      <ResourceLoadingState
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        load={load}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  if (knowledge.state === 'missing') {
    return (
      <EmptyResourceState
        label="Resource not found"
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        onOpenLeftSidebar={onOpenLeftSidebar}
      />
    )
  }
  const resource = knowledge.value
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
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        mode={mode}
        resource={resource}
        runtime={runtime}
        onModeChange={onModeChange}
        onOpenHistory={onOpenHistory}
        onOpenLeftSidebar={onOpenLeftSidebar}
        onOpenRightSidebar={onOpenRightSidebar}
      />
      {!canEditViewport && (
        <div className="shrink-0 border-b border-border bg-muted/50 px-3 py-1 text-center text-xs text-muted-foreground">
          {mode === 'viewer' ? 'Viewer mode — editing is disabled' : 'Read only'}
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
          <Menu className="size-4" />
        </button>
      )}
    </div>
  )
}

function ResizableWorkspacePanel({
  children,
  onCommit,
  panel,
  preference,
}: {
  children: ReactNode
  onCommit: (size: number) => void
  panel: 'left' | 'right'
  preference: WorkspacePanelPreference
}) {
  const panelElement = useRef<HTMLDivElement>(null)
  const resize = (size: number) => {
    const bounded = boundedPanelSize(size)
    if (panelElement.current) panelElement.current.style.width = `${bounded}px`
    return bounded
  }

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startSize = panelElement.current?.getBoundingClientRect().width ?? preference.size
    const move = (moveEvent: globalThis.PointerEvent) => {
      const delta = moveEvent.clientX - startX
      resize(startSize + (panel === 'left' ? delta : -delta))
    }
    const finish = (upEvent: globalThis.PointerEvent) => {
      const delta = upEvent.clientX - startX
      const nextSize = resize(startSize + (panel === 'left' ? delta : -delta))
      onCommit(nextSize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
  }

  return (
    <div
      ref={panelElement}
      className={`relative z-20 h-full min-h-0 shrink-0 ${panel === 'left' ? 'border-r' : 'border-l'} border-border max-md:absolute max-md:inset-y-0 ${panel === 'left' ? 'max-md:left-0' : 'max-md:right-0'}`}
      style={{ width: preference.size }}
    >
      {children}
      <div
        role="separator"
        aria-label={`Resize ${panel} sidebar`}
        aria-orientation="vertical"
        aria-valuemax={600}
        aria-valuemin={200}
        aria-valuenow={preference.size}
        className={`absolute inset-y-0 z-30 w-1 cursor-col-resize touch-none ${panel === 'left' ? '-right-0.5' : '-left-0.5'}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const currentSize = panelElement.current?.getBoundingClientRect().width ?? preference.size
          const nextSize = resize(currentSize + direction * (panel === 'left' ? 10 : -10))
          onCommit(nextSize)
        }}
        onPointerDown={startResize}
      />
    </div>
  )
}

function boundedPanelSize(size: number) {
  return Math.min(600, Math.max(200, Math.round(size)))
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
