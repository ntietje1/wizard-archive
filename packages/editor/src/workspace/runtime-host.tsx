import { useRef } from 'react'
import type { ReactNode } from 'react'
import { PanelLeft, PanelLeftOpen } from 'lucide-react'

import { ResizableSidebar } from '@wizard-archive/ui/components/resizable-sidebar'
import { buttonVariants } from '@wizard-archive/ui/shadcn/components/button-variants'
import { RESOURCE_TYPES } from './items-persistence-contract'
import { WorkspaceRuntimeDndProvider } from './dnd-provider'
import { WorkspaceRuntimeProvider } from './runtime-context'
import { WorkspaceRuntimeItemSurfaceHotkeys } from './item-surface-hotkeys'
import type { WorkspaceRuntime } from './runtime'
import { NoteScrollRequestProvider } from '../notes/scroll-request-provider'
import { useNoteHeadingScrollRequest } from '../notes/headings/scroll-request'
import { useActiveNoteHeadingNavigation } from '../notes/outline/note-outline'
import { NoteEditorStoreProvider } from '../notes/editor-store'
import type { CanvasViewportStore } from '../canvas/runtime/interaction/canvas-viewport-storage'
import type { MapTransformStore } from '../game-maps/viewer/transform-state'
import type { NoteScrollStore } from '../notes/viewer/use-scroll-persistence'
import { handleError } from '../errors/handle-error'
import { WorkspaceRuntimeSidebarContent } from './sidebar/workspace-runtime-sidebar-content'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
  NAV_COLUMN_WIDTH,
} from './sidebar/components/sidebar-toolbar/constants'
import { WorkspaceRuntimeSidebarProviders } from './sidebar-providers'
import { MapPinMenuStateProvider } from '../game-maps/context-menu/state-context'
import { useRightSidebar } from './right-sidebar/use-right-sidebar'
import { createRuntimeRightSidebarSource } from './right-sidebar/runtime-source'
import { getRightSidebarAvailablePanels } from './right-sidebar/source'
import { WorkspaceRuntimeShell } from './runtime-shell'
import { WorkspaceRuntimeSearchDialog } from './search-dialog'
import { WorkspaceRuntimeSearchRequestProvider } from './search-request-provider'
import { usePanelPreference } from '@wizard-archive/ui/panel-preferences/use-panel-preference'
import { ViewAsBanner } from './view-as-banner'
import { useFileSystemUndoHotkeys } from '../filesystem/hotkeys'
import {
  useRuntimeSidebarWorkspaceState,
  useRuntimeSidebarWorkspaceStateWithSort,
} from './sidebar/workspace-state'
import type { SidebarWorkspaceSort, SidebarWorkspaceState } from './sidebar/workspace-state'
import { WorkspacePanelPreferencesController } from './panel-preferences-controller'
import type { MaybePromise } from '../../../../shared/common/async'

type WorkspaceRuntimeHostSidebarMode = 'fixed' | 'none' | 'resizable'

export interface WorkspaceViewStateStores {
  canvasViewport: CanvasViewportStore
  mapTransform: MapTransformStore
  noteScroll: NoteScrollStore
}

interface WorkspaceRuntimeHostPanelPreference {
  size: number | null
  visible: boolean | null
}

interface WorkspaceRuntimeHostPanelPreferenceChange {
  panelId: string
  size: number
  visible: boolean
}

export interface WorkspaceRuntimeHostPanelPreferencesSource {
  appliedPanelPreferences: Record<string, WorkspaceRuntimeHostPanelPreference> | null
  initialPanelPreferences: Record<string, WorkspaceRuntimeHostPanelPreference> | null
  isLoaded: boolean
  onPanelPreferenceChange?: (
    preference: WorkspaceRuntimeHostPanelPreferenceChange,
  ) => MaybePromise<void>
}

const DEFAULT_PANEL_PREFERENCES_SOURCE = {
  appliedPanelPreferences: null,
  initialPanelPreferences: null,
  isLoaded: true,
} satisfies WorkspaceRuntimeHostPanelPreferencesSource

interface WorkspaceRuntimeHostSidebarSlots {
  bottomPanel?: ReactNode
  railEndControls?: ReactNode
  railStartControls?: ReactNode
}

interface WorkspaceRuntimeHostNoteHeadingRequest {
  heading?: string | null
  onConsumed?: () => void
}

type WorkspaceRuntimeHostBaseProps = {
  ariaLabel: string
  noteHeadingRequest?: WorkspaceRuntimeHostNoteHeadingRequest
  panelPreferences: WorkspaceRuntimeHostPanelPreferencesSource
  runtime: WorkspaceRuntime
  sidebar: WorkspaceRuntimeHostSidebarMode
  sidebarSlots?: WorkspaceRuntimeHostSidebarSlots
  viewStateStores: WorkspaceViewStateStores
  workspaceName: string | null
}

export function WorkspaceRuntimeHost({
  ariaLabel,
  noteHeadingRequest,
  panelPreferences,
  runtime,
  sidebar = 'fixed',
  sidebarSlots,
  sidebarSort,
  viewStateStores,
  workspaceName,
}: Omit<WorkspaceRuntimeHostBaseProps, 'panelPreferences' | 'sidebar'> & {
  panelPreferences?: WorkspaceRuntimeHostPanelPreferencesSource
  sidebar?: WorkspaceRuntimeHostSidebarMode
  sidebarSort?: SidebarWorkspaceSort
}) {
  const resolvedPanelPreferences = panelPreferences ?? DEFAULT_PANEL_PREFERENCES_SOURCE
  const baseProps = {
    ariaLabel,
    noteHeadingRequest,
    panelPreferences: resolvedPanelPreferences,
    runtime,
    sidebar,
    sidebarSlots,
    viewStateStores,
    workspaceName,
  }

  if (sidebarSort) {
    return (
      <WorkspacePanelPreferencesController source={resolvedPanelPreferences}>
        <WorkspaceRuntimeHostWithSourceSort {...baseProps} sidebarSort={sidebarSort} />
      </WorkspacePanelPreferencesController>
    )
  }

  return (
    <WorkspacePanelPreferencesController source={resolvedPanelPreferences}>
      <WorkspaceRuntimeHostWithDefaultSidebarState {...baseProps} />
    </WorkspacePanelPreferencesController>
  )
}

function WorkspaceRuntimeHostWithDefaultSidebarState(props: WorkspaceRuntimeHostBaseProps) {
  const sidebarWorkspaceState = useRuntimeSidebarWorkspaceState(props.runtime)

  return (
    <WorkspaceRuntimeHostWithSidebarState
      {...props}
      sidebarWorkspaceState={sidebarWorkspaceState}
    />
  )
}

function WorkspaceRuntimeHostWithSourceSort({
  sidebarSort,
  ...props
}: WorkspaceRuntimeHostBaseProps & { sidebarSort: SidebarWorkspaceSort }) {
  const sidebarWorkspaceState = useRuntimeSidebarWorkspaceStateWithSort(props.runtime, sidebarSort)

  return (
    <WorkspaceRuntimeHostWithSidebarState
      {...props}
      sidebarWorkspaceState={sidebarWorkspaceState}
    />
  )
}

function WorkspaceRuntimeHostWithSidebarState({
  ariaLabel,
  noteHeadingRequest,
  runtime,
  sidebar,
  sidebarSlots,
  sidebarWorkspaceState,
  viewStateStores,
  workspaceName,
}: WorkspaceRuntimeHostBaseProps & {
  sidebarWorkspaceState: SidebarWorkspaceState
}) {
  const canDropExternalFiles = runtime.filesystem.permissions.canCreateItems

  return (
    <MapPinMenuStateProvider>
      <WorkspaceRuntimeSidebarProviders
        runtime={runtime}
        sidebarWorkspaceState={sidebarWorkspaceState}
      >
        {(sidebarRuntime) => (
          <WorkspaceRuntimeProvider value={sidebarRuntime}>
            <NoteEditorStoreProvider>
              <WorkspaceRuntimeDndProvider
                externalFiles={
                  canDropExternalFiles ? { status: 'enabled' } : { status: 'disabled' }
                }
                runtime={sidebarRuntime}
                workspaceName={workspaceName}
              >
                <WorkspaceRuntimeHostContent
                  ariaLabel={ariaLabel}
                  noteHeadingRequest={noteHeadingRequest}
                  runtime={sidebarRuntime}
                  sidebar={sidebar}
                  sidebarSlots={sidebarSlots}
                  viewStateStores={viewStateStores}
                />
              </WorkspaceRuntimeDndProvider>
            </NoteEditorStoreProvider>
          </WorkspaceRuntimeProvider>
        )}
      </WorkspaceRuntimeSidebarProviders>
    </MapPinMenuStateProvider>
  )
}

function WorkspaceRuntimeHostContent({
  ariaLabel,
  noteHeadingRequest,
  runtime,
  sidebar,
  sidebarSlots,
  viewStateStores,
}: {
  ariaLabel: string
  noteHeadingRequest?: WorkspaceRuntimeHostNoteHeadingRequest
  runtime: WorkspaceRuntime
  sidebar: WorkspaceRuntimeHostSidebarMode
  sidebarSlots?: WorkspaceRuntimeHostSidebarSlots
  viewStateStores: WorkspaceViewStateStores
}) {
  const hotkeyScopeRef = useRef<HTMLDivElement | null>(null)
  const historyOperations = runtime.filesystem.operations.history
  const navigateToHeading = useActiveNoteHeadingNavigation()
  const rightSidebarSource = createRuntimeRightSidebarSource(runtime, { navigateToHeading })
  const rightSidebar = useRightSidebar(
    runtime.filesystem.current.item?.type,
    getRightSidebarAvailablePanels(rightSidebarSource),
  )
  const contentItem = runtime.filesystem.current.contentItem
  const noteScrollRequest = useNoteHeadingScrollRequest({
    content:
      contentItem?.type === RESOURCE_TYPES.notes && noteHeadingRequest
        ? contentItem.content
        : undefined,
    heading: noteHeadingRequest?.heading,
    onConsumed: noteHeadingRequest?.onConsumed,
  })
  useFileSystemUndoHotkeys(
    {
      ...historyOperations,
      reportError: handleError,
    },
    { scopeRef: hotkeyScopeRef },
  )

  return (
    <NoteScrollRequestProvider value={noteScrollRequest}>
      <WorkspaceRuntimeSearchRequestProvider scopeRef={hotkeyScopeRef}>
        <div ref={hotkeyScopeRef} className="relative flex h-full min-h-0 flex-1 flex-col">
          <WorkspaceRuntimeItemSurfaceHotkeys runtime={runtime} scopeRef={hotkeyScopeRef} />
          <WorkspaceRuntimeShell
            ariaLabel={ariaLabel}
            rightSidebar={{ source: rightSidebarSource, state: rightSidebar }}
            sidebar={
              <WorkspaceRuntimeHostSidebar mode={sidebar} runtime={runtime} slots={sidebarSlots} />
            }
            viewStateStores={viewStateStores}
          />
          <WorkspaceRuntimeSearchDialog runtime={runtime} />
          <ViewAsBanner viewAsPlayer={runtime.filesystem.sharing.viewAsParticipant} />
        </div>
      </WorkspaceRuntimeSearchRequestProvider>
    </NoteScrollRequestProvider>
  )
}

function WorkspaceRuntimeHostSidebar({
  mode,
  runtime,
  slots,
}: {
  mode: WorkspaceRuntimeHostSidebarMode
  runtime: WorkspaceRuntime
  slots?: WorkspaceRuntimeHostSidebarSlots
}) {
  if (mode === 'none') return null
  if (mode === 'fixed') {
    return (
      <WorkspaceRuntimeSidebarContent
        bottomPanel={slots?.bottomPanel}
        layout="fixed"
        railEndControls={slots?.railEndControls}
        railStartControls={slots?.railStartControls}
        runtime={runtime}
        showPanelDivider={true}
      />
    )
  }

  return <WorkspaceRuntimeResizableSidebar runtime={runtime} slots={slots} />
}

function WorkspaceRuntimeResizableSidebar({
  runtime,
  slots,
}: {
  runtime: WorkspaceRuntime
  slots?: WorkspaceRuntimeHostSidebarSlots
}) {
  const panelState = usePanelPreference(LEFT_SIDEBAR_PANEL_ID, LEFT_SIDEBAR_DEFAULTS)

  return (
    <ResizableSidebar
      side="left"
      size={panelState.size}
      visible={panelState.visible}
      onSizeChange={panelState.setSize}
      onVisibleChange={panelState.setVisible}
      isLoaded={panelState.isLoaded}
      extraWidth={NAV_COLUMN_WIDTH}
    >
      <WorkspaceRuntimeSidebarContent
        bottomPanel={slots?.bottomPanel}
        layout="fill"
        railEndControls={slots?.railEndControls}
        railStartControls={slots?.railStartControls}
        runtime={runtime}
        showPanelDivider={panelState.visible}
        topStartControls={
          <button
            type="button"
            data-slot="button"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            onClick={() => panelState.setVisible(!panelState.visible)}
            aria-label={panelState.visible ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {panelState.visible ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        }
      />
    </ResizableSidebar>
  )
}
