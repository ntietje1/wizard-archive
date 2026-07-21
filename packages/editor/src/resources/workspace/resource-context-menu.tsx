import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  Clipboard,
  ClipboardPaste,
  ChevronRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileInput,
  FolderInput,
  Hash,
  Loader2,
  Palette,
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
import { ResourceAppearancePopover } from './resource-appearance-popover'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-presentation'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'
import type {
  ResourceRightSidebarPanel,
  ResourceRightSidebarPanelOption,
} from './resource-right-sidebar-panels'

type ResourceContextMenuCommonProps = Readonly<{
  actions: WorkspaceActions
  canEdit: boolean
  onClose: () => void
  onRequestMove: (resourceIds: ReadonlyArray<ResourceId>) => void
  request: ResourceContextMenuRequest
}>

type ResourceSurfaceContextMenuProps = ResourceContextMenuCommonProps &
  Readonly<{
    surface: 'resource'
    bookmarksAvailable: boolean
    bookmarkedIds: ReadonlySet<ResourceId>
    campaignId: CampaignId
    clipboard: WorkspaceClipboard
    navigation: ResourceNavigation
    resourceIds: ReadonlyArray<ResourceId>
    onClipboardChange: (clipboard: WorkspaceClipboard) => void
  }>

type TopbarContextMenuProps = ResourceContextMenuCommonProps &
  Readonly<{
    surface: 'topbar'
    activePanel: ResourceRightSidebarPanel
    panels: ReadonlyArray<ResourceRightSidebarPanelOption>
    rightSidebarVisible: boolean
    onOpenPanel: (panel: ResourceRightSidebarPanel) => void
  }>

export function ResourceContextMenu(
  props: ResourceSurfaceContextMenuProps | TopbarContextMenuProps,
) {
  const menu = useRef<HTMLDivElement>(null)
  const { onClose, onRequestMove, request } = props
  const workspace = props.actions
  const resource = props.request.resource
  const resourceIds = props.surface === 'resource' ? props.resourceIds : [resource.id]
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const close = (event: PointerEvent) => {
      const target = event.target as Element
      if (!menu.current?.contains(target) && !target.closest('[data-resource-appearance]'))
        onClose()
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
      <ResourceContextMenuItems
        actions={actions}
        confirmDelete={confirmDelete}
        props={props}
        onConfirmDelete={() => setConfirmDelete(true)}
      />
    </div>
  )
}

function ResourceContextMenuItems({
  actions,
  confirmDelete,
  onConfirmDelete,
  props,
}: {
  actions: ResourceMenuActions
  confirmDelete: boolean
  onConfirmDelete: () => void
  props: ResourceSurfaceContextMenuProps | TopbarContextMenuProps
}) {
  if (props.surface === 'resource') {
    return (
      <ResourceSurfaceMenuItems
        actions={actions}
        confirmDelete={confirmDelete}
        props={props}
        onConfirmDelete={onConfirmDelete}
      />
    )
  }
  return (
    <TopbarSurfaceMenuItems
      actions={actions}
      confirmDelete={confirmDelete}
      props={props}
      onConfirmDelete={onConfirmDelete}
    />
  )
}

function ResourceSurfaceMenuItems({
  actions,
  confirmDelete,
  onConfirmDelete,
  props,
}: {
  actions: ResourceMenuActions
  confirmDelete: boolean
  onConfirmDelete: () => void
  props: ResourceSurfaceContextMenuProps
}) {
  const active = actions.resource.lifecycle === 'active'
  const singleResource = actions.resourceIds.length === 1
  return (
    <>
      <MenuItem
        icon={<ExternalLink />}
        label="Open"
        onActivate={() =>
          runMenuOperation(actions, () => actions.workspace.open(actions.resource.id))
        }
      />
      {props.canEdit && active && (
        <ActiveResourceMenuItems
          actions={actions}
          campaignId={props.campaignId}
          clipboard={props.clipboard}
          navigation={props.navigation}
          onClipboardChange={props.onClipboardChange}
          submenuSide={props.request.x > globalThis.innerWidth - 460 ? 'left' : 'right'}
        />
      )}
      {props.canEdit && active && singleResource && (
        <ResourceAppearanceMenuItem actions={actions} />
      )}
      {singleResource && <ResourceLinkMenuItems actions={actions} separated />}
      {props.bookmarksAvailable && active && (
        <ResourceBookmarkMenuItem actions={actions} bookmarkedIds={props.bookmarkedIds} />
      )}
      {props.canEdit && (
        <ResourceLifecycleMenuItems
          actions={actions}
          confirmDelete={confirmDelete}
          onConfirmDelete={onConfirmDelete}
        />
      )}
    </>
  )
}

function TopbarSurfaceMenuItems({
  actions,
  confirmDelete,
  onConfirmDelete,
  props,
}: {
  actions: ResourceMenuActions
  confirmDelete: boolean
  onConfirmDelete: () => void
  props: TopbarContextMenuProps
}) {
  const active = actions.resource.lifecycle === 'active'
  return (
    <>
      {props.canEdit && active && (
        <MenuItem
          icon={<FolderInput />}
          label="Move…"
          onActivate={() =>
            runMenuOperation(actions, () => props.onRequestMove(actions.resourceIds))
          }
        />
      )}
      {props.canEdit && active && <ResourceAppearanceMenuItem actions={actions} />}
      <ResourceLinkMenuItems actions={actions} separated={props.canEdit && active} />
      <ResourcePanelMenuItems
        actions={actions}
        activePanel={props.activePanel}
        panels={props.panels}
        rightSidebarVisible={props.rightSidebarVisible}
        onOpenPanel={props.onOpenPanel}
      />
      {props.canEdit && (
        <ResourceLifecycleMenuItems
          actions={actions}
          confirmDelete={confirmDelete}
          onConfirmDelete={onConfirmDelete}
        />
      )}
    </>
  )
}

function ResourceAppearanceMenuItem({ actions }: { actions: ResourceMenuActions }) {
  return (
    <ResourceAppearancePopover
      actions={actions.workspace}
      resource={actions.resource}
      trigger={
        <button
          role="menuitem"
          type="button"
          className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted"
        >
          <Palette className="size-4" />
          Edit icon and color
        </button>
      }
    />
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
  campaignId,
  clipboard,
  navigation,
  onClipboardChange,
  submenuSide,
}: {
  actions: ResourceMenuActions
  campaignId: CampaignId
  clipboard: WorkspaceClipboard
  navigation: ResourceNavigation
  onClipboardChange: (clipboard: WorkspaceClipboard) => void
  submenuSide: 'left' | 'right'
}) {
  const { resource, resourceIds, workspace } = actions
  const destinationId = resource.kind === 'folder' ? resource.id : null
  const creation = useWorkspaceCreation(campaignId, navigation, destinationId)
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
          <NewResourceSubmenu
            actions={workspace}
            creation={creation}
            destinationParentId={destinationId}
            onClose={actions.onClose}
            side={submenuSide}
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
      {destinationId !== null && (
        <MenuItem
          disabled={!canPaste}
          icon={<ClipboardPaste />}
          label="Paste"
          shortcut="Ctrl+V"
          onActivate={() => runMenuOperation(actions, paste)}
        />
      )}
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

export function NewResourceSubmenu({
  actions,
  creation,
  destinationParentId,
  onClose,
  side,
}: {
  actions: WorkspaceActions
  creation: ReturnType<typeof useWorkspaceCreation>
  destinationParentId: ResourceId | null
  onClose: () => void
  side: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onPointerEnter={() => setOpen(true)}>
      <button
        role="menuitem"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted"
        onClick={() => setOpen((current) => !current)}
      >
        <Plus className="size-4" />
        <span className="min-w-0 flex-1">New…</span>
        <ChevronRight className={`size-4 ${side === 'left' ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="New resource"
          className={`absolute top-0 z-10 w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ${
            side === 'left' ? 'right-full mr-1' : 'left-full ml-1'
          }`}
        >
          {(['note', 'folder', 'map', 'canvas', 'file'] as const).map((kind) => {
            const Icon = resourceKindIcon(kind)
            const pending = creation.pendingControlId === kind
            return (
              <MenuItem
                busy={pending}
                disabled={creation.blocked}
                key={kind}
                icon={pending ? <Loader2 className="animate-spin" /> : <Icon />}
                label={resourceKindLabel(kind)}
                onActivate={() =>
                  void creation
                    .run(kind, (signal) => actions.create(kind, destinationParentId, '', signal))
                    .then((settlement) => {
                      if (settlement.status === 'completed') onClose()
                    })
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ResourceLinkMenuItems({
  actions,
  separated,
}: {
  actions: ResourceMenuActions
  separated: boolean
}) {
  const { resource, workspace } = actions
  return (
    <>
      {separated && <MenuSeparator />}
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

function ResourcePanelMenuItems({
  actions,
  activePanel,
  onOpenPanel,
  panels,
  rightSidebarVisible,
}: {
  actions: ResourceMenuActions
  activePanel: ResourceRightSidebarPanel
  onOpenPanel: (panel: ResourceRightSidebarPanel) => void
  panels: ReadonlyArray<ResourceRightSidebarPanelOption>
  rightSidebarVisible: boolean
}) {
  const availablePanels = panels.filter((panel) => panel.available)
  if (availablePanels.length === 0) return null
  return (
    <>
      <MenuSeparator />
      {availablePanels.map((panel) => (
        <MenuItem
          checked={rightSidebarVisible && panel.id === activePanel}
          icon={<panel.icon />}
          key={panel.id}
          label={panel.label}
          onActivate={() => runMenuOperation(actions, () => onOpenPanel(panel.id))}
        />
      ))}
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
  checked = false,
  danger = false,
  disabled = false,
  icon,
  label,
  onActivate,
  shortcut,
}: {
  busy?: boolean
  checked?: boolean
  danger?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
  onActivate?: () => void
  shortcut?: string
}) {
  return (
    <button
      role="menuitem"
      type="button"
      aria-label={label}
      aria-busy={busy}
      aria-current={checked ? 'true' : undefined}
      disabled={disabled}
      className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50 ${danger ? 'text-destructive' : ''}`}
      onClick={onActivate}
    >
      <span className="[&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
      {checked && <Check className="size-4" aria-hidden="true" />}
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
