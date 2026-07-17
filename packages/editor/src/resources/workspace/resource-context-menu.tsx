import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileInput,
  FileUp,
  FolderInput,
  Hash,
  Loader2,
  Plus,
  RotateCcw,
  Scissors,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import type { CampaignId, ResourceId } from '../domain-id'
import type { ResourceNavigation } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'

export function ResourceContextMenu({
  canEdit,
  actions: workspace,
  bookmarksAvailable,
  campaignId,
  clipboard,
  onClipboardChange,
  onClose,
  onRequestMove,
  navigation,
  request,
  resourceIds,
  bookmarkedIds,
}: {
  actions: WorkspaceActions
  bookmarksAvailable: boolean
  campaignId: CampaignId
  canEdit: boolean
  clipboard: WorkspaceClipboard
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  onClose: () => void
  onRequestMove: (resourceIds: ReadonlyArray<ResourceId>) => void
  navigation: ResourceNavigation
  request: ResourceContextMenuRequest
  resourceIds: ReadonlyArray<ResourceId>
  bookmarkedIds: ReadonlySet<ResourceId>
}) {
  const menu = useRef<HTMLDivElement>(null)
  const resource = request.resource
  const active = resource.lifecycle === 'active'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const destinationId = resource.kind === 'folder' ? resource.id : null
  const creation = useWorkspaceCreation(campaignId, navigation, destinationId)

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])

  const actions = { onClose, onRequestMove, resource, resourceIds, workspace }

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
        onActivate={() => runMenuOperation(actions, () => workspace.open(resource.id))}
      />
      {canEdit && active && (
        <ActiveResourceMenuItems
          actions={actions}
          clipboard={clipboard}
          creation={creation}
          onClipboardChange={onClipboardChange}
        />
      )}
      {resourceIds.length === 1 && <ResourceLinkMenuItems actions={actions} />}
      {bookmarksAvailable && active && (
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
            actions.workspace.bookmark(actions.resourceIds, !bookmarked),
          )
        }
      />
    </>
  )
}

type ResourceMenuActions = Readonly<{
  onClose: () => void
  onRequestMove: (resourceIds: ReadonlyArray<ResourceId>) => void
  resource: AuthorizedResourceSummary
  resourceIds: ReadonlyArray<ResourceId>
  workspace: WorkspaceActions
}>

function ActiveResourceMenuItems({
  actions,
  clipboard,
  creation,
  onClipboardChange,
}: {
  actions: ResourceMenuActions
  clipboard: WorkspaceClipboard
  creation: ReturnType<typeof useWorkspaceCreation>
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
}) {
  const { resource, resourceIds, workspace } = actions
  const upload = useRef<HTMLInputElement>(null)
  const destinationId = resource.kind === 'folder' ? resource.id : null
  const canPaste =
    destinationId !== null &&
    clipboard.status === 'ready' &&
    !clipboard.resourceIds.includes(destinationId)
  const paste = async () => {
    if (destinationId === null) return
    onClipboardChange(await workspace.paste(clipboard, destinationId))
  }
  return (
    <>
      <MenuSeparator />
      {destinationId !== null && (
        <>
          {(['note', 'folder', 'map', 'canvas'] as const).map((kind) => (
            <MenuItem
              busy={creation.pendingControlId === kind}
              disabled={creation.blocked}
              key={kind}
              icon={
                creation.pendingControlId === kind ? <Loader2 className="animate-spin" /> : <Plus />
              }
              label={`New ${resourceKindLabel(kind)}`}
              onActivate={() =>
                void creation
                  .run(kind, (signal) => workspace.create(kind, destinationId, '', signal))
                  .then((settlement) => {
                    if (settlement.status === 'completed') actions.onClose()
                  })
              }
            />
          ))}
          <MenuItem
            busy={creation.pendingControlId === 'file'}
            disabled={creation.blocked}
            icon={
              creation.pendingControlId === 'file' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileUp />
              )
            }
            label="Upload File"
            onActivate={() => upload.current?.click()}
          />
          <input
            ref={upload}
            type="file"
            className="hidden"
            aria-label={`Upload file to ${resource.title}`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                void creation
                  .run('file', (signal) => workspace.createFile(destinationId, file, signal))
                  .then((settlement) => {
                    if (settlement.status === 'completed') actions.onClose()
                  })
              }
            }}
          />
          <WorkspaceCreationStatus creation={creation} onCompleted={actions.onClose} />
          <MenuSeparator />
        </>
      )}
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
            workspace.duplicate(resourceIds, resource.displayParentId),
          )
        }
      />
      <MenuItem
        icon={<FolderInput />}
        label="Move…"
        onActivate={() => runMenuOperation(actions, () => actions.onRequestMove(resourceIds))}
      />
    </>
  )
}

function ResourceLinkMenuItems({ actions }: { actions: ResourceMenuActions }) {
  const { resource, workspace } = actions
  return (
    <>
      <MenuSeparator />
      <MenuItem
        icon={<FileInput />}
        label="Copy link"
        onActivate={() => runMenuOperation(actions, () => workspace.copyLink(resource))}
      />
      <MenuItem
        icon={<Hash />}
        label="Copy resource ID"
        onActivate={() => runMenuOperation(actions, () => workspace.copyId(resource))}
      />
      {resource.kind !== 'folder' && (
        <MenuItem
          icon={<Download />}
          label="Download"
          onActivate={() => runMenuOperation(actions, () => workspace.download(resource))}
        />
      )}
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
  const { resource, resourceIds, workspace } = actions
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
            runMenuOperation(actions, () => workspace.changeLifecycle(resourceIds, 'trash'))
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
          runMenuOperation(actions, () => workspace.changeLifecycle(resourceIds, 'restore'))
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
            workspace.changeLifecycle(resourceIds, 'permanentlyDelete'),
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
  busy = false,
  danger = false,
  disabled = false,
  icon,
  label,
  onActivate,
  shortcut,
}: {
  busy?: boolean
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
      aria-busy={busy}
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
