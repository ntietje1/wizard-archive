import { useState } from 'react'
import {
  Clipboard,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileInput,
  FolderInput,
  Hash,
  Loader2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Star,
  StarOff,
  Trash2,
  Upload,
} from 'lucide-react'
import type { CampaignId, ResourceId } from '../domain-id'
import type { EditorRuntime, ResourceNavigation } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import type { AssetReplacementController } from '../asset-replacement'
import type { VersionStamp } from '../component-version'
import type { MapSession } from '../content-session-contract'
import type { WorkspaceClipboard } from '../workspace-clipboard'
import { useFileReplacement } from '../../files/file-replacement'
import { useMapImageReplacement } from '../../maps/map-image-replacement'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { ResourceAppearancePopover } from './resource-appearance-popover'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-presentation'
import { useResourceStoreSnapshot } from './resource-store-snapshot'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'
import type {
  ResourceRightSidebarPanel,
  ResourceRightSidebarPanelOption,
} from './resource-right-sidebar-panels'
import {
  WorkspaceMenu,
  WorkspaceMenuItem as MenuItem,
  WorkspaceMenuSeparator as MenuSeparator,
  WorkspaceMenuSubmenu,
} from './workspace-menu'

type ResourceContextMenuCommonProps = Readonly<{
  actions: WorkspaceActions
  canEdit: boolean
  runtime: EditorRuntime
  onClose: () => void
  onRequestRename: () => void
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
  const { onClose, onRequestMove, onRequestRename, request } = props
  const workspace = props.actions
  const resource = props.request.resource
  const resourceIds = props.surface === 'resource' ? props.resourceIds : [resource.id]
  const [confirmDelete, setConfirmDelete] = useState(false)

  const actions = { onClose, onRequestMove, onRequestRename, resource, resourceIds, workspace }

  return (
    <WorkspaceMenu
      label={`${resource.title} actions`}
      x={request.x}
      y={request.y}
      onClose={onClose}
    >
      <ResourceContextMenuItems
        actions={actions}
        confirmDelete={confirmDelete}
        props={props}
        onConfirmDelete={() => setConfirmDelete(true)}
      />
    </WorkspaceMenu>
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
          runtime={props.runtime}
          showRename={singleResource && props.request.origin === 'sidebar'}
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
        <>
          <ResourceRenameMenuItem actions={actions} />
          <MenuItem
            icon={<FolderInput />}
            label="Move…"
            onActivate={() =>
              runMenuOperation(actions, () => props.onRequestMove(actions.resourceIds))
            }
          />
          <ResourceReplacementMenuItem actions={actions} runtime={props.runtime} />
        </>
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
  onRequestRename: () => void
  resource: AuthorizedResourceSummary
  resourceIds: ReadonlyArray<ResourceId>
  workspace: WorkspaceActions
}>

function ResourceRenameMenuItem({ actions }: { actions: ResourceMenuActions }) {
  return (
    <MenuItem
      icon={<Pencil />}
      label="Rename"
      onActivate={() => runMenuOperation(actions, actions.onRequestRename)}
    />
  )
}

function ResourceReplacementMenuItem({
  actions,
  runtime,
}: {
  actions: ResourceMenuActions
  runtime: EditorRuntime
}) {
  switch (actions.resource.kind) {
    case 'file':
      return <FileReplacementMenuItem resourceId={actions.resource.id} runtime={runtime} />
    case 'map':
      return <MapReplacementMenuItem resourceId={actions.resource.id} runtime={runtime} />
    case 'canvas':
    case 'folder':
    case 'note':
      return null
  }
}

function FileReplacementMenuItem({
  resourceId,
  runtime,
}: {
  resourceId: ResourceId
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.files, resourceId)
  if (state.status !== 'ready') {
    return <UnavailableReplacementMenuItem label="Replace File" />
  }
  return (
    <ReadyFileReplacementMenuItem
      resourceId={resourceId}
      runtime={runtime}
      version={state.version}
    />
  )
}

function ReadyFileReplacementMenuItem({
  resourceId,
  runtime,
  version,
}: {
  resourceId: ResourceId
  runtime: EditorRuntime
  version: VersionStamp
}) {
  const replacement = useFileReplacement(runtime.content.files, resourceId, version)
  return (
    <AssetReplacementMenuItem
      chooseLabel="Choose file replacement"
      label="Replace File"
      replacement={replacement}
    />
  )
}

function MapReplacementMenuItem({
  resourceId,
  runtime,
}: {
  resourceId: ResourceId
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.maps, resourceId)
  if (state.status !== 'ready') {
    return <UnavailableReplacementMenuItem label="Replace Map Image" />
  }
  return <ReadyMapReplacementMenuItem resourceId={resourceId} session={state.session} />
}

function ReadyMapReplacementMenuItem({
  resourceId,
  session,
}: {
  resourceId: ResourceId
  session: MapSession
}) {
  const replacement = useMapImageReplacement(session, resourceId)
  return (
    <AssetReplacementMenuItem
      chooseLabel="Choose map image replacement"
      label="Replace Map Image"
      replacement={replacement}
    />
  )
}

function UnavailableReplacementMenuItem({ label }: { label: string }) {
  return <MenuItem disabled icon={<Upload />} label={label} />
}

function AssetReplacementMenuItem({
  chooseLabel,
  label,
  replacement,
}: {
  chooseLabel: string
  label: string
  replacement: AssetReplacementController
}) {
  return (
    <>
      <MenuItem
        busy={replacement.pending}
        disabled={replacement.pending}
        icon={replacement.pending ? <Loader2 className="animate-spin" /> : <Upload />}
        label={label}
        onActivate={replacement.open}
      />
      <input
        ref={replacement.input}
        aria-label={chooseLabel}
        className="sr-only"
        disabled={replacement.pending}
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) replacement.choose(file)
        }}
      />
      {replacement.message && (
        <div className="px-2 py-1 text-xs text-muted-foreground">
          <p role={replacement.failed ? 'alert' : 'status'}>{replacement.message}</p>
          {replacement.canRetry && (
            <button
              type="button"
              role="menuitem"
              className="mt-1 underline"
              onClick={replacement.retry}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </>
  )
}

function ActiveResourceMenuItems({
  actions,
  campaignId,
  clipboard,
  navigation,
  runtime,
  showRename,
  onClipboardChange,
  submenuSide,
}: {
  actions: ResourceMenuActions
  campaignId: CampaignId
  clipboard: WorkspaceClipboard
  navigation: ResourceNavigation
  runtime: EditorRuntime
  showRename: boolean
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
      {showRename && <ResourceRenameMenuItem actions={actions} />}
      {resourceIds.length === 1 && (
        <ResourceReplacementMenuItem actions={actions} runtime={runtime} />
      )}
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
  return (
    <WorkspaceMenuSubmenu icon={<Plus />} label="New…" menuLabel="New resource" side={side}>
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
    </WorkspaceMenuSubmenu>
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
