import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Eye, Menu, MoreVertical, PanelRightOpen, Pencil, Share2 } from 'lucide-react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspacePreferences } from '../workspace-preferences'
import {
  changeWorkspaceResourcesLifecycle,
  copyWorkspaceResourceLink,
  duplicateWorkspaceResources,
  moveWorkspaceResources,
  updateWorkspaceResource,
} from './resource-operations'
import type { WorkspaceReport } from './resource-operations'

export function ResourceTopbar({
  canEdit,
  leftSidebarAvailable,
  leftSidebarVisible,
  mode,
  onModeChange,
  onOpenHistory,
  onOpenLeftSidebar,
  onOpenRightSidebar,
  onReport,
  resource,
  runtime,
}: {
  canEdit: boolean
  leftSidebarAvailable: boolean
  leftSidebarVisible: boolean
  mode: WorkspacePreferences['mode']
  onModeChange: (mode: WorkspacePreferences['mode']) => void
  onOpenHistory: () => void
  onOpenLeftSidebar: () => void
  onOpenRightSidebar: () => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const ancestors = runtime.resources.index.getSnapshot().ancestors(resource.id)
  const breadcrumb = ancestors.state === 'known' ? ancestors.value : []
  const historyAvailable = runtime.history.status === 'available'

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
              onClick={() => runtime.navigation.open(ancestor.id)}
            >
              {ancestor.title}
            </button>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          </span>
        ))}
        {editing ? (
          <ResourceTitleForm
            resource={resource}
            runtime={runtime}
            onCancel={() => setEditing(false)}
            onReport={onReport}
          />
        ) : (
          <h1 className="min-w-0 truncate px-1 text-sm font-medium" title={resource.title}>
            {resource.title}
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
      {runtime.resources.structure.status === 'available' && (
        <div
          className="hidden items-center rounded-md border border-border p-0.5 sm:flex"
          aria-label="Workspace mode"
        >
          {(['editor', 'viewer'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              className="rounded px-2 py-0.5 text-xs capitalize text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
              onClick={() => onModeChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      {runtime.scope.projection === 'player' && (
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Eye className="size-3.5" /> Player view
        </span>
      )}
      <TopbarIcon
        disabled={runtime.resources.access.status !== 'available'}
        label="Share"
        title={
          runtime.resources.access.status === 'available'
            ? 'Share resource'
            : 'Sharing is unavailable in this workspace'
        }
      >
        <Share2 className="size-4" />
      </TopbarIcon>
      <TopbarIcon label="Open resource panel" onClick={onOpenRightSidebar}>
        <PanelRightOpen className="size-4" />
      </TopbarIcon>
      <div className="relative">
        <TopbarIcon label="More options" onClick={() => setMenuOpen((value) => !value)}>
          <MoreVertical className="size-4" />
        </TopbarIcon>
        {menuOpen && (
          <ResourceMenu
            canEdit={canEdit}
            resource={resource}
            runtime={runtime}
            onClose={() => setMenuOpen(false)}
            onEdit={() => {
              setMenuOpen(false)
              setEditing(true)
            }}
            onReport={onReport}
          />
        )}
      </div>
    </header>
  )
}

function ResourceMenu({
  canEdit,
  onClose,
  onEdit,
  onReport,
  resource,
  runtime,
}: {
  canEdit: boolean
  onClose: () => void
  onEdit: () => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
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
          <MenuButton onClick={onEdit}>Edit details</MenuButton>
          <MenuButton
            onClick={() =>
              run(() =>
                duplicateWorkspaceResources(
                  runtime,
                  [resource.id],
                  resource.displayParentId,
                  onReport,
                ),
              )
            }
          >
            Duplicate
          </MenuButton>
          {resource.displayParentId !== null && (
            <MenuButton
              onClick={() =>
                run(() => moveWorkspaceResources(runtime, [resource.id], null, onReport))
              }
            >
              Move to root
            </MenuButton>
          )}
        </>
      )}
      <MenuButton onClick={() => run(() => copyWorkspaceResourceLink(runtime, resource, onReport))}>
        Copy link
      </MenuButton>
      {canEdit && resource.lifecycle === 'active' && (
        <MenuButton
          ariaLabel={`Move ${resource.title} to trash`}
          destructive
          onClick={() =>
            run(() => changeWorkspaceResourcesLifecycle(runtime, [resource.id], 'trash', onReport))
          }
        >
          Move to trash
        </MenuButton>
      )}
      {canEdit && resource.lifecycle === 'trashed' && (
        <>
          <MenuButton
            ariaLabel={`Restore ${resource.title}`}
            onClick={() =>
              run(() =>
                changeWorkspaceResourcesLifecycle(runtime, [resource.id], 'restore', onReport),
              )
            }
          >
            Restore
          </MenuButton>
          {confirmDelete ? (
            <MenuButton
              ariaLabel={`Confirm delete ${resource.title} forever`}
              destructive
              onClick={() =>
                run(() =>
                  changeWorkspaceResourcesLifecycle(
                    runtime,
                    [resource.id],
                    'permanentlyDelete',
                    onReport,
                  ),
                )
              }
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

function ResourceTitleForm({
  onCancel,
  onReport,
  resource,
  runtime,
}: {
  onCancel: () => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [title, setTitle] = useState<string>(resource.title)
  const [icon, setIcon] = useState(resource.icon ?? '')
  const [color, setColor] = useState(resource.color ?? '')
  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        void updateWorkspaceResource(runtime, resource.id, { title, icon, color }, onReport).then(
          (completed) => completed && onCancel(),
        )
      }}
    >
      <input
        autoFocus
        aria-label="Resource title"
        className="h-7 min-w-32 flex-1 rounded border border-input bg-background px-2 text-sm"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        aria-label="Resource icon"
        className="hidden h-7 w-20 rounded border border-input bg-background px-2 text-xs md:block"
        placeholder="Icon"
        value={icon}
        onChange={(event) => setIcon(event.target.value)}
      />
      <input
        aria-label="Resource color"
        className="hidden h-7 w-20 rounded border border-input bg-background px-2 text-xs md:block"
        placeholder="Color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
      />
      <TopbarIcon label="Cancel editing" onClick={onCancel}>
        <span className="text-xs">Cancel</span>
      </TopbarIcon>
      <button
        type="submit"
        className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs text-primary-foreground"
      >
        <Pencil className="size-3" /> Save
      </button>
    </form>
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
  onClick: () => void
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
