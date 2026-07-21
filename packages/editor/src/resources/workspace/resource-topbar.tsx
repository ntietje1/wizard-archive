import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronRight,
  Eye,
  MoreVertical,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'
import { ResourceSharingControl } from './resource-sharing-control'
import { ResourceViewAsMenu } from '../resource-view-as-menu'
import { ResourceContextMenu } from './resource-context-menu'
import { ResourceRenameInput } from './resource-rename-input'
import { resourceRightSidebarPanels } from './resource-right-sidebar-panels'
import type { ResourceRightSidebarPanel } from './resource-right-sidebar-panels'

export function ResourceTopbar({
  actions,
  activeRightPanel,
  canEdit,
  leftSidebarAvailable,
  leftSidebarVisible,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenLeftSidebar,
  onOpenRightPanel,
  onToggleRightSidebar,
  onRequestMove,
  resource,
  rightSidebarVisible,
  runtime,
}: {
  actions: WorkspaceActions
  activeRightPanel: ResourceRightSidebarPanel
  canEdit: boolean
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onOpenHistory: () => void
  onOpenLeftSidebar: () => void
  onOpenRightPanel: (panel: ResourceRightSidebarPanel) => void
  onToggleRightSidebar: () => void
  onRequestMove: (resourceIds: ReadonlyArray<AuthorizedResourceSummary['id']>) => void
  resource: AuthorizedResourceSummary
  rightSidebarVisible: boolean
  runtime: EditorRuntime
}) {
  const [editing, setEditing] = useState(false)
  const [menuPosition, setMenuPosition] = useState<Readonly<{ x: number; y: number }> | null>(null)
  const menuAnchor = useRef<HTMLDivElement>(null)
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const breadcrumb = ancestors.state === 'known' ? ancestors.value : []
  const historyAvailable = runtime.history.status === 'available' && resource.permission === 'edit'
  const viewAs = runtime.viewAs.status === 'available' ? runtime.viewAs.value : null
  const rightSidebarPanels = resourceRightSidebarPanels(resource, runtime)

  return (
    <header className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-1">
      {leftSidebarAvailable && !leftSidebarVisible && (
        <TopbarIcon label="Open sidebar" onClick={onOpenLeftSidebar}>
          <PanelLeftOpen className="size-4" />
        </TopbarIcon>
      )}
      <div className="flex min-w-0 flex-1 items-center pl-1">
        {breadcrumb.map((ancestor) => (
          <span key={ancestor.id} className="flex min-w-0 items-center">
            <button
              type="button"
              className="max-w-32 truncate rounded px-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => actions.open(ancestor.id)}
            >
              {ancestor.title}
            </button>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          </span>
        ))}
        {editing ? (
          <ResourceRenameInput
            actions={actions}
            ariaLabel="Resource title"
            className="h-7 min-w-32 flex-1 rounded border border-input bg-background px-2 text-sm"
            resource={resource}
            onComplete={() => setEditing(false)}
          />
        ) : (
          <h1 className="min-w-0 truncate px-1 text-sm font-medium" title={resource.title}>
            <button
              type="button"
              className="max-w-full truncate rounded px-0.5 text-left hover:bg-muted disabled:pointer-events-none"
              disabled={!canEdit || resource.lifecycle !== 'active'}
              onClick={() => setEditing(true)}
            >
              {resource.title}
            </button>
          </h1>
        )}
      </div>
      {historyAvailable && (
        <button
          type="button"
          aria-label={`Open history, edited ${formatRelativeTime(resource.updatedAt)}`}
          className="hidden shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          onClick={onOpenHistory}
        >
          Edited {formatRelativeTime(resource.updatedAt)}
        </button>
      )}
      <ResourceViewAsMenu
        mode={mode}
        participants={viewAs?.participants}
        pending={viewAs?.pending}
        projection={runtime.scope.projection}
        selectedParticipantId={viewAs?.selectedParticipantId}
        onModeChange={onModeChange}
        onParticipantChange={(participantId) => viewAs?.select(participantId)}
      />
      {runtime.scope.projection === 'player' && (
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Eye className="size-3.5" /> Player view
        </span>
      )}
      {runtime.scope.projection === 'dm' && (
        <ResourceSharingControl resource={resource} runtime={runtime} />
      )}
      <TopbarIcon
        label={rightSidebarVisible ? 'Close resource panel' : 'Open resource panel'}
        onClick={onToggleRightSidebar}
      >
        {rightSidebarVisible ? (
          <PanelRightClose className="size-4" />
        ) : (
          <PanelRightOpen className="size-4" />
        )}
      </TopbarIcon>
      <div ref={menuAnchor} className="relative">
        <TopbarIcon
          label="More options"
          onClick={() => {
            if (menuPosition) {
              setMenuPosition(null)
              return
            }
            const bounds = menuAnchor.current?.getBoundingClientRect()
            if (!bounds) return
            setMenuPosition({ x: bounds.right - 224, y: bounds.bottom + 4 })
          }}
        >
          <MoreVertical className="size-4" />
        </TopbarIcon>
        {menuPosition && (
          <ResourceContextMenu
            actions={actions}
            activePanel={activeRightPanel}
            canEdit={canEdit}
            panels={rightSidebarPanels}
            request={{ origin: 'topbar', resource, ...menuPosition }}
            rightSidebarVisible={rightSidebarVisible}
            runtime={runtime}
            surface="topbar"
            onClose={() => setMenuPosition(null)}
            onOpenPanel={onOpenRightPanel}
            onRequestMove={onRequestMove}
            onRequestRename={() => setEditing(true)}
          />
        )}
      </div>
    </header>
  )
}

function TopbarIcon({
  children,
  disabled,
  label,
  onClick,
  title,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
    >
      {children}
    </button>
  )
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
