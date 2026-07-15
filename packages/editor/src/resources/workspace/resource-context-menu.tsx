import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  ExternalLink,
  FileInput,
  FolderInput,
  Hash,
  RotateCcw,
  Scissors,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import {
  changeWorkspaceResourcesLifecycle,
  copyWorkspaceResourceId,
  copyWorkspaceResourceLink,
  duplicateWorkspaceResources,
  moveWorkspaceResources,
  pasteWorkspaceClipboard,
  setWorkspaceBookmarkState,
} from './resource-operations'
import type { WorkspaceReport } from './resource-operations'

export function ResourceContextMenu({
  canEdit,
  clipboard,
  onClipboardChange,
  onClose,
  onReport,
  request,
  resourceIds,
  runtime,
  bookmarkedIds,
}: {
  canEdit: boolean
  clipboard: WorkspaceClipboard
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  onClose: () => void
  onReport: WorkspaceReport
  request: ResourceContextMenuRequest
  resourceIds: ReadonlyArray<ResourceId>
  runtime: EditorRuntime
  bookmarkedIds: ReadonlySet<ResourceId>
}) {
  const menu = useRef<HTMLDivElement>(null)
  const resource = request.resource
  const active = resource.lifecycle === 'active'
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])

  const actions = { onClose, onReport, resource, resourceIds, runtime }

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`${resource.title} actions`}
      className="fixed z-[70] w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={boundedMenuPosition(request.x, request.y)}
      onKeyDown={(event) => navigateMenu(event, onClose)}
    >
      <MenuItem
        icon={<ExternalLink />}
        label="Open"
        onActivate={() => runMenuOperation(actions, () => runtime.navigation.open(resource.id))}
      />
      {canEdit && active && (
        <ActiveResourceMenuItems
          actions={actions}
          clipboard={clipboard}
          onClipboardChange={onClipboardChange}
        />
      )}
      {resourceIds.length === 1 && <ResourceLinkMenuItems actions={actions} />}
      {runtime.resources.bookmarks.status === 'available' && active && (
        <ResourceBookmarkMenuItem actions={actions} bookmarkedIds={bookmarkedIds} />
      )}
      {canEdit && (
        <ResourceLifecycleMenuItems
          actions={actions}
          confirmDelete={confirmDelete}
          onConfirmDelete={() => setConfirmDelete(true)}
        />
      )}
    </div>
  )
}

function ResourceBookmarkMenuItem({
  actions,
  bookmarkedIds,
}: {
  actions: ResourceMenuActions
  bookmarkedIds: ReadonlySet<ResourceId>
}) {
  const bookmarked = actions.resourceIds.every((resourceId) => bookmarkedIds.has(resourceId))
  return (
    <>
      <MenuSeparator />
      <MenuItem
        icon={bookmarked ? <StarOff /> : <Star />}
        label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
        onActivate={() =>
          runMenuOperation(actions, () =>
            setWorkspaceBookmarkState(
              actions.runtime,
              actions.resourceIds,
              !bookmarked,
              actions.onReport,
            ),
          )
        }
      />
    </>
  )
}

type ResourceMenuActions = Readonly<{
  onClose: () => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  resourceIds: ReadonlyArray<ResourceId>
  runtime: EditorRuntime
}>

function ActiveResourceMenuItems({
  actions,
  clipboard,
  onClipboardChange,
}: {
  actions: ResourceMenuActions
  clipboard: WorkspaceClipboard
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
}) {
  const { resource, resourceIds, runtime, onReport } = actions
  const destinationId = resource.kind === 'folder' ? resource.id : null
  const canPaste =
    destinationId !== null &&
    clipboard.status === 'ready' &&
    !clipboard.resourceIds.includes(destinationId)
  const paste = async () => {
    if (destinationId === null) return
    onClipboardChange(await pasteWorkspaceClipboard(runtime, clipboard, destinationId, onReport))
  }
  return (
    <>
      <MenuSeparator />
      <MenuItem
        icon={<Clipboard />}
        label={resourceIds.length > 1 ? `Copy ${resourceIds.length} items` : 'Copy'}
        shortcut="Ctrl+C"
        onActivate={() =>
          runMenuOperation(actions, () =>
            onClipboardChange({ status: 'ready', operation: 'copy', resourceIds }),
          )
        }
      />
      <MenuItem
        icon={<Scissors />}
        label={resourceIds.length > 1 ? `Cut ${resourceIds.length} items` : 'Cut'}
        shortcut="Ctrl+X"
        onActivate={() =>
          runMenuOperation(actions, () =>
            onClipboardChange({ status: 'ready', operation: 'move', resourceIds }),
          )
        }
      />
      <MenuItem
        disabled={!canPaste}
        icon={<ClipboardPaste />}
        label="Paste into folder"
        shortcut="Ctrl+V"
        onActivate={() => runMenuOperation(actions, paste)}
      />
      <MenuItem
        icon={<Copy />}
        label={resourceIds.length > 1 ? `Duplicate ${resourceIds.length} items` : 'Duplicate'}
        shortcut="Ctrl+D"
        onActivate={() =>
          runMenuOperation(actions, () =>
            duplicateWorkspaceResources(runtime, resourceIds, resource.displayParentId, onReport),
          )
        }
      />
      {resource.displayParentId !== null && (
        <MenuItem
          icon={<FolderInput />}
          label="Move to workspace root"
          onActivate={() =>
            runMenuOperation(actions, () =>
              moveWorkspaceResources(runtime, resourceIds, null, onReport),
            )
          }
        />
      )}
    </>
  )
}

function ResourceLinkMenuItems({ actions }: { actions: ResourceMenuActions }) {
  const { resource, runtime, onReport } = actions
  return (
    <>
      <MenuSeparator />
      <MenuItem
        icon={<FileInput />}
        label="Copy link"
        onActivate={() =>
          runMenuOperation(actions, () => copyWorkspaceResourceLink(runtime, resource, onReport))
        }
      />
      <MenuItem
        icon={<Hash />}
        label="Copy resource ID"
        onActivate={() =>
          runMenuOperation(actions, () => copyWorkspaceResourceId(resource, onReport))
        }
      />
    </>
  )
}

function ResourceLifecycleMenuItems({
  actions,
  confirmDelete,
  onConfirmDelete,
}: {
  actions: ResourceMenuActions
  confirmDelete: boolean
  onConfirmDelete: () => void
}) {
  const { resource, resourceIds, runtime, onReport } = actions
  if (resource.lifecycle === 'active') {
    return (
      <>
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash2 />}
          label={
            resourceIds.length > 1 ? `Move ${resourceIds.length} items to Trash` : 'Move to Trash'
          }
          shortcut="Delete"
          onActivate={() =>
            runMenuOperation(actions, () =>
              changeWorkspaceResourcesLifecycle(runtime, resourceIds, 'trash', onReport),
            )
          }
        />
      </>
    )
  }
  return (
    <>
      <MenuSeparator />
      <MenuItem
        icon={<RotateCcw />}
        label={resourceIds.length > 1 ? `Restore ${resourceIds.length} items` : 'Restore'}
        onActivate={() =>
          runMenuOperation(actions, () =>
            changeWorkspaceResourcesLifecycle(runtime, resourceIds, 'restore', onReport),
          )
        }
      />
      <MenuItem
        danger
        icon={<Trash2 />}
        label={
          confirmDelete
            ? resourceIds.length > 1
              ? `Confirm delete ${resourceIds.length} items forever`
              : `Confirm delete ${resource.title} forever`
            : resourceIds.length > 1
              ? `Delete ${resourceIds.length} items forever`
              : 'Delete Forever'
        }
        onActivate={() => {
          if (!confirmDelete) {
            onConfirmDelete()
            return
          }
          runMenuOperation(actions, () =>
            changeWorkspaceResourcesLifecycle(runtime, resourceIds, 'permanentlyDelete', onReport),
          )
        }}
      />
    </>
  )
}

function runMenuOperation(actions: ResourceMenuActions, operation: () => unknown) {
  actions.onClose()
  void operation()
}

function MenuItem({
  danger = false,
  disabled = false,
  icon,
  label,
  onActivate,
  shortcut,
}: {
  danger?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
  onActivate: () => void
  shortcut?: string
}) {
  return (
    <button
      role="menuitem"
      type="button"
      aria-label={label}
      disabled={disabled}
      className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50 ${danger ? 'text-destructive' : ''}`}
      onClick={onActivate}
    >
      <span className="[&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  )
}

function MenuSeparator() {
  return <hr className="my-1 border-0 border-t border-border" />
}

function navigateMenu(event: KeyboardEvent<HTMLDivElement>, onClose: () => void) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    onClose()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
  ]
  if (items.length === 0) return
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[nextIndex]?.focus()
}

function boundedMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { left: x, top: y }
  return {
    left: Math.max(8, Math.min(x, window.innerWidth - 232)),
    top: Math.max(8, Math.min(y, window.innerHeight - 420)),
  }
}
