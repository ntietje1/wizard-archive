import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Eye, FolderInput, Menu, MoreVertical, PanelRightOpen } from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceActions } from './resource-operations'
import { ResourceSharingControl } from './resource-sharing-control'
import { ResourceViewAsMenu } from '../resource-view-as-menu'

export function ResourceTopbar({
  actions,
  canEdit,
  leftSidebarAvailable,
  leftSidebarVisible,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenLeftSidebar,
  onOpenRightSidebar,
  onRequestMove,
  resource,
  runtime,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onOpenHistory: () => void
  onOpenLeftSidebar: () => void
  onOpenRightSidebar: () => void
  onRequestMove: (resourceIds: ReadonlyArray<AuthorizedResourceSummary['id']>) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const breadcrumb = ancestors.state === 'known' ? ancestors.value : []
  const historyAvailable = runtime.history.status === 'available' && resource.permission === 'edit'
  const viewAs = runtime.viewAs.status === 'available' ? runtime.viewAs.value : null

  return (
    <header className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border px-1">
      {leftSidebarAvailable && !leftSidebarVisible && (
        <TopbarIcon label="Open sidebar" onClick={onOpenLeftSidebar}>
          <Menu className="size-4" />
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
          <ResourceTitleInput
            actions={actions}
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
      <TopbarIcon label="Open resource panel" onClick={onOpenRightSidebar}>
        <PanelRightOpen className="size-4" />
      </TopbarIcon>
      <div className="relative">
        <TopbarIcon label="More options" onClick={() => setMenuOpen((value) => !value)}>
          <MoreVertical className="size-4" />
        </TopbarIcon>
        {menuOpen && (
          <ResourceMenu
            actions={actions}
            canEdit={canEdit}
            resource={resource}
            onClose={() => setMenuOpen(false)}
            onRequestMove={onRequestMove}
          />
        )}
      </div>
    </header>
  )
}

function ResourceMenu({
  actions,
  canEdit,
  onClose,
  onRequestMove,
  resource,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  onClose: () => void
  onRequestMove: (resourceIds: ReadonlyArray<AuthorizedResourceSummary['id']>) => void
  resource: AuthorizedResourceSummary
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const run = (operation: () => Promise<unknown>) => {
    onClose()
    void operation()
  }
  return (
    <div
      role="menu"
      className="absolute right-0 top-8 z-40 w-52 rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
    >
      {canEdit && resource.lifecycle === 'active' && (
        <>
          <MenuButton
            onClick={() => run(() => actions.duplicate([resource.id], resource.displayParentId))}
          >
            Duplicate
          </MenuButton>
          <MenuButton
            onClick={() => {
              onClose()
              onRequestMove([resource.id])
            }}
          >
            <FolderInput className="mr-2 size-4" />
            Move…
          </MenuButton>
        </>
      )}
      <MenuButton onClick={() => run(() => actions.copyLink(resource))}>Copy link</MenuButton>
      {canEdit && resource.lifecycle === 'active' && (
        <MenuButton
          ariaLabel={`Move ${resource.title} to trash`}
          destructive
          onClick={() => run(() => actions.changeLifecycle([resource.id], 'trash'))}
        >
          Move to trash
        </MenuButton>
      )}
      {canEdit && resource.lifecycle === 'trashed' && (
        <>
          <MenuButton
            ariaLabel={`Restore ${resource.title}`}
            onClick={() => run(() => actions.changeLifecycle([resource.id], 'restore'))}
          >
            Restore
          </MenuButton>
          {confirmDelete ? (
            <MenuButton
              ariaLabel={`Confirm delete ${resource.title} forever`}
              destructive
              onClick={() => run(() => actions.changeLifecycle([resource.id], 'permanentlyDelete'))}
            >
              Confirm delete forever
            </MenuButton>
          ) : (
            <MenuButton
              ariaLabel={`Delete ${resource.title} forever`}
              destructive
              onClick={() => setConfirmDelete(true)}
            >
              Delete forever
            </MenuButton>
          )}
        </>
      )}
    </div>
  )
}

function ResourceTitleInput({
  actions,
  onComplete,
  resource,
}: {
  actions: WorkspaceActions
  onComplete: () => void
  resource: AuthorizedResourceSummary
}) {
  const [title, setTitle] = useState<string>(resource.title)
  const cancelled = useRef(false)
  const commit = () => {
    if (cancelled.current || title === resource.title) {
      onComplete()
      return
    }
    void actions.update(resource.id, { title }).then((completed) => {
      if (completed) onComplete()
    })
  }
  return (
    <input
      autoFocus
      aria-label="Resource title"
      className="h-7 min-w-32 flex-1 rounded border border-input bg-background px-2 text-sm"
      value={title}
      onBlur={commit}
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelled.current = true
          onComplete()
        } else if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
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

function MenuButton({
  ariaLabel,
  children,
  destructive,
  onClick,
}: {
  ariaLabel?: string
  children: ReactNode
  destructive?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`flex h-8 w-full items-center rounded px-2 text-left hover:bg-muted ${destructive ? 'text-destructive' : ''}`}
      role="menuitem"
      onClick={onClick}
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
