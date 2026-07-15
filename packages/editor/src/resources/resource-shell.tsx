import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PointerEvent, ReactNode } from 'react'
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
import { useEnsureResource } from './workspace/resource-loading'
import { ResourceContextMenu } from './workspace/resource-context-menu'
import type { ResourceContextMenuRequest } from './workspace/resource-context-menu-request'
import { ResourceSidebar } from './workspace/resource-sidebar'
import { ResourceTopbar } from './workspace/resource-topbar'
import { ResourceViewport, ViewportState } from './workspace/resource-viewport'
import { ResourceRightSidebar } from './workspace/resource-right-sidebar'
import type { ResourceRightSidebarPanel } from './workspace/resource-right-sidebar'
import type { WorkspaceReport } from './workspace/resource-operations'

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
  const selectedResourceId = useResourceSelection(runtime)
  const preferencesState = useWorkspacePreferences(runtime)
  const preferences =
    preferencesState.status === 'ready'
      ? preferencesState.snapshot.value
      : DEFAULT_WORKSPACE_PREFERENCES
  const selectedLoad = useEnsureResource(runtime, selectedResourceId)
  const selected: ResourceKnowledge<AuthorizedResourceSummary> = selectedResourceId
    ? snapshot.lookup(selectedResourceId)
    : { state: 'unknown' }
  const [lifecycle, setLifecycle] = useState<'active' | 'trashed'>('active')
  const [selection, setSelection] = useState(EMPTY_WORKSPACE_SELECTION)
  const [clipboard, setClipboard] = useState(EMPTY_WORKSPACE_CLIPBOARD)
  const [contextMenu, setContextMenu] = useState<
    | Readonly<{ status: 'closed' }>
    | Readonly<{
        status: 'open'
        request: ResourceContextMenuRequest
        resourceIds: ReadonlyArray<ResourceId>
      }>
  >({ status: 'closed' })
  const [notice, setNotice] = useState<{ message: string; retry?: () => void } | null>(null)
  const [rightPanel, setRightPanel] = useState<ResourceRightSidebarPanel>('details')
  const report: WorkspaceReport = (message, retry) =>
    setNotice({ message, ...(retry ? { retry } : {}) })
  const leftVisible = showResourcePanel && preferences.panels.left.visible
  const rightVisible = selected.state === 'known' && preferences.panels.right.visible
  const canEdit =
    runtime.resources.structure.status === 'available' && preferences.mode === 'editor'
  const changeSelection = (action: WorkspaceSelectionAction) =>
    setSelection((current) => updateWorkspaceSelection(current, action))
  const openContextMenu = (request: ResourceContextMenuRequest) => {
    const resourceIds = selection.selectedIds.includes(request.resource.id)
      ? selection.selectedIds
      : [request.resource.id]
    changeSelection({ type: 'normalizeContext', resourceId: request.resource.id })
    setContextMenu({ status: 'open', request, resourceIds })
  }
  const closeContextMenu = () => setContextMenu({ status: 'closed' })

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

  return (
    <section
      aria-label={ariaLabel}
      className="relative flex h-full min-h-0 overflow-hidden bg-background text-foreground"
    >
      {leftVisible && (
        <ResizableWorkspacePanel
          panel="left"
          preference={preferences.panels.left}
          onCommit={(size) => changePreference({ type: 'panel', panel: 'left', size })}
        >
          <ResourceSidebar
            canEdit={canEdit}
            lifecycle={lifecycle}
            runtime={runtime}
            selectedResourceId={selectedResourceId}
            selection={selection}
            slots={resourcePanelSlots}
            snapshot={snapshot}
            sort={preferences.sort}
            workspaceName={workspaceName}
            onLifecycleChange={setLifecycle}
            onClose={() => changePreference({ type: 'panel', panel: 'left', visible: false })}
            onReport={report}
            onOpenContextMenu={openContextMenu}
            onSelectionChange={changeSelection}
            onSortChange={(sort) => changePreference({ type: 'sort', sort })}
          />
        </ResizableWorkspacePanel>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <SelectedResource
          canEdit={canEdit}
          knowledge={selected}
          leftSidebarAvailable={showResourcePanel}
          leftSidebarVisible={leftVisible}
          load={selectedLoad}
          mode={preferences.mode}
          resourceId={selectedResourceId}
          runtime={runtime}
          selection={selection}
          snapshot={snapshot}
          sort={preferences.sort}
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
          onReport={report}
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
            activePanel={rightPanel}
            resource={selected.value}
            runtime={runtime}
            onActivePanelChange={setRightPanel}
            onClose={() => changePreference({ type: 'panel', panel: 'right', visible: false })}
            onReport={report}
          />
        </ResizableWorkspacePanel>
      )}
      {contextMenu.status === 'open' && (
        <ResourceContextMenu
          canEdit={canEdit}
          clipboard={clipboard}
          request={contextMenu.request}
          resourceIds={contextMenu.resourceIds}
          runtime={runtime}
          onClipboardChange={setClipboard}
          onClose={closeContextMenu}
          onReport={report}
        />
      )}
      {notice && (
        <div
          role="status"
          className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
        >
          <span>{notice.message}</span>
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
      )}
    </section>
  )
}

function SelectedResource({
  canEdit,
  knowledge,
  leftSidebarAvailable,
  leftSidebarVisible,
  load,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenContextMenu,
  onOpenLeftSidebar,
  onOpenRightSidebar,
  onReport,
  onSelectionChange,
  resourceId,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  canEdit: boolean
  knowledge: ResourceKnowledge<AuthorizedResourceSummary>
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  load: { result: ResourceLoadResult | null; retry: () => void }
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onOpenHistory: () => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onOpenLeftSidebar: () => void
  onOpenRightSidebar: () => void
  onReport: WorkspaceReport
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resourceId: ResourceId | null
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: typeof DEFAULT_WORKSPACE_PREFERENCES.sort
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
  return (
    <>
      <ResourceTopbar
        canEdit={canEdit}
        leftSidebarAvailable={leftSidebarAvailable}
        leftSidebarVisible={leftSidebarVisible}
        mode={mode}
        resource={resource}
        runtime={runtime}
        onModeChange={onModeChange}
        onOpenHistory={onOpenHistory}
        onOpenLeftSidebar={onOpenLeftSidebar}
        onOpenRightSidebar={onOpenRightSidebar}
        onReport={onReport}
      />
      {!canEdit && (
        <div className="shrink-0 border-b border-border bg-muted/50 px-3 py-1 text-center text-xs text-muted-foreground">
          {runtime.resources.structure.status === 'available'
            ? 'Viewer mode — editing is disabled'
            : 'Read only'}
        </div>
      )}
      <ResourceViewport
        canEdit={canEdit}
        resource={resource}
        runtime={runtime}
        selection={selection}
        snapshot={snapshot}
        sort={sort}
        onReport={onReport}
        onOpenContextMenu={onOpenContextMenu}
        onSelectionChange={onSelectionChange}
      />
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

function useResourceSnapshot(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.resources.index.subscribe(listener),
    () => runtime.resources.index.getSnapshot(),
    () => runtime.resources.index.getSnapshot(),
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
