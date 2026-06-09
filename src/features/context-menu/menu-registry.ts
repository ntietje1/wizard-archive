import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { EDITOR_MODE } from 'shared/editor/types'
import type { PermissionLevel } from 'shared/permissions/types'
import { createElement } from 'react'
import {
  Bookmark,
  BookOpen,
  ClipboardCopy,
  Download,
  ClipboardPaste,
  Eye,
  EyeOff,
  FileEdit,
  FileTypeIcon,
  Files,
  FolderDown,
  MapPin,
  Move,
  Navigation,
  Plus,
  RotateCcw,
  Share2,
  Sigma,
  Scissors,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import * as p from './predicates'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuGroupConfig,
  ContextMenuItemSpec,
  EditorContextMenuActionHandlers,
  EditorContextMenuServices,
  EditorMenuContext,
  EditorModeMenuService,
  ViewAsPlayerMenuService,
} from './types'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import { RIGHT_SIDEBAR_PANEL_ID } from '~/features/editor/components/right-sidebar/constants'
import {
  canShowRightSidebarContent,
  resolveRightSidebarContent,
} from '~/features/editor/components/right-sidebar/right-sidebar-model'
import { RIGHT_SIDEBAR_PANELS } from '~/features/editor/components/right-sidebar/right-sidebar-registry'
import { useRightSidebarStateStore } from '~/features/editor/stores/right-sidebar-state-store'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import { logger } from '~/shared/utils/logger'
import { assertNever } from '~/shared/utils/utils'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'
import { ViewAsPlayerRow } from '~/features/editor/components/view-as-player-row'
import { getCampaignMemberDisplayName } from '~/shared/utils/user-display-name'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'

function isPanelContentActive(
  context: EditorMenuContext,
  contentId: RightSidebarContentId,
): boolean {
  if (!context.item || !canShowRightSidebarContent(context.item.type, contentId)) return false
  const panel = usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]
  const activeContentId = resolveRightSidebarContent(
    context.item.type,
    useRightSidebarStateStore.getState().activeContentByItemType[context.item.type],
  )
  return panel?.visible === true && activeContentId === contentId
}

function activatePanelContent(context: EditorMenuContext, contentId: RightSidebarContentId): void {
  if (!context.item || !canShowRightSidebarContent(context.item.type, contentId)) return
  const store = usePanelPreferenceStore.getState()
  useRightSidebarStateStore.getState().setActiveContent(context.item.type, contentId)
  store.setVisible(RIGHT_SIDEBAR_PANEL_ID, true)
}

function getTypeName(context: EditorMenuContext): string {
  if (!context.item) return 'Item'

  switch (context.item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    case SIDEBAR_ITEM_TYPES.canvases:
      return 'Canvas'
    default:
      return assertNever(context.item)
  }
}

function getUnpinnedMapItems(context: EditorMenuContext) {
  if (!context.activeMap) return []
  const pins = context.activeMap.pins ?? []
  const pinnedItemIds = new Set(pins.map((pin) => pin.itemId))
  return (context.selectedItems ?? []).filter(
    (item) => item._id !== context.activeMap?._id && !pinnedItemIds.has(item._id),
  )
}

type EditorContextMenuItem = ContextMenuItemSpec<EditorMenuContext, EditorContextMenuServices>
type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

type SimpleActionKey = Exclude<keyof EditorContextMenuActionHandlers, 'setGeneralAccessLevel'>
type SidebarItemCreationActionKey = Pick<
  EditorContextMenuActionHandlers,
  'createNote' | 'createFolder' | 'createMap' | 'createCanvas' | 'createFile'
>
type SidebarItemCreationActionId = keyof SidebarItemCreationActionKey

const sidebarItemCreationActionIds = {
  'create.note': 'createNote',
  'create.folder': 'createFolder',
  'create.map': 'createMap',
  'create.canvas': 'createCanvas',
  'create.file': 'createFile',
} satisfies Record<
  (typeof SIDEBAR_ITEM_CREATION_COMMANDS)[number]['id'],
  SidebarItemCreationActionId
>

function nextEditorMode(currentMode: EditorModeMenuService['editorMode']) {
  return currentMode === EDITOR_MODE.EDITOR ? EDITOR_MODE.VIEWER : EDITOR_MODE.EDITOR
}

function getBlockShareTargetLabel(blockCount: number) {
  return blockCount === 1 ? 'Block' : `${blockCount} Blocks`
}

function getBlockShareActionLabel(context: EditorMenuContext, services: EditorContextMenuServices) {
  const blockCount = services.blockShare.getBlockCount(context)
  const targetLabel = getBlockShareTargetLabel(blockCount)
  const allPlayersPermissionLevel = services.blockShare.getAllPlayersPermissionLevel(context)
  return allPlayersPermissionLevel === 'visible' ? `Unshare ${targetLabel}` : `Share ${targetLabel}`
}

function createViewAsPlayerItems(
  services: EditorContextMenuServices,
): Array<EditorContextMenuItem> {
  return services.viewAsPlayer.playerMembers.map((member, index) => ({
    id: `view-as-player-${index}`,
    commandId: 'setViewAsPlayer',
    payload: member._id,
    label: getCampaignMemberDisplayName(member),
    content: createElement(ViewAsPlayerRow, { member }),
    group: 'view-as-player',
    priority: index,
    isChecked: (_context, itemServices, playerId) =>
      itemServices.viewAsPlayer.viewAsPlayerId === playerId,
    closeOnSelect: false,
  }))
}

function createActionCommand(
  id: SimpleActionKey,
): ContextMenuCommand<EditorMenuContext, EditorContextMenuServices> {
  return {
    id,
    run: (context, services) => services.actions[id](context),
  }
}

export const editorContextMenuCommands = {
  open: createActionCommand('open'),
  rename: createActionCommand('rename'),
  delete: createActionCommand('delete'),
  showInSidebar: createActionCommand('showInSidebar'),
  createNote: createActionCommand('createNote'),
  createFolder: createActionCommand('createFolder'),
  createMap: createActionCommand('createMap'),
  createFile: createActionCommand('createFile'),
  createCanvas: createActionCommand('createCanvas'),
  editMap: createActionCommand('editMap'),
  editFile: createActionCommand('editFile'),
  editItem: createActionCommand('editItem'),
  pinToMap: createActionCommand('pinToMap'),
  goToMapPin: createActionCommand('goToMapPin'),
  createMapPin: createActionCommand('createMapPin'),
  removeMapPin: createActionCommand('removeMapPin'),
  moveMapPin: createActionCommand('moveMapPin'),
  togglePinVisibility: createActionCommand('togglePinVisibility'),
  startSession: createActionCommand('startSession'),
  endSession: createActionCommand('endSession'),
  downloadItems: createActionCommand('downloadItems'),
  downloadAll: createActionCommand('downloadAll'),
  toggleBookmark: createActionCommand('toggleBookmark'),
  paste: createActionCommand('paste'),
  duplicate: createActionCommand('duplicate'),
  restore: createActionCommand('restore'),
  permanentlyDelete: createActionCommand('permanentlyDelete'),
  emptyTrash: createActionCommand('emptyTrash'),
  setGeneralAccessLevel: {
    id: 'setGeneralAccessLevel',
    run: (context, services, payload) =>
      services.actions.setGeneralAccessLevel(context, (payload as PermissionLevel | null) ?? null),
  },
  activatePanel: {
    id: 'activatePanel',
    run: (context, _services, payload) => {
      if (
        typeof payload !== 'string' ||
        !Object.values(RIGHT_SIDEBAR_CONTENT).includes(payload as RightSidebarContentId)
      ) {
        logger.warn('activatePanel received invalid payload', payload)
        return
      }
      activatePanelContent(context, payload as RightSidebarContentId)
    },
  },
  showComingSoon: {
    id: 'showComingSoon',
    run: () => {
      toast.info('Coming soon')
    },
  },
  editValueInline: {
    id: 'editValueInline',
    run: (context) => {
      if (!context.valueInlineId) return
      context.openValueInline?.(context.valueInlineId, context.valueInlineInstanceId)
    },
  },
  toggleReadingMode: {
    id: 'toggleReadingMode',
    run: (_context, services) => {
      services.editorMode.setEditorMode(nextEditorMode(services.editorMode.editorMode))
    },
  },
  setViewAsPlayer: {
    id: 'setViewAsPlayer',
    run: (_context, services, payload) => {
      const playerId = payload as ViewAsPlayerMenuService['viewAsPlayerId']
      services.viewAsPlayer.setViewAsPlayerId(
        services.viewAsPlayer.viewAsPlayerId === playerId ? undefined : playerId,
      )
    },
  },
} satisfies Record<string, ContextMenuCommand<EditorMenuContext, EditorContextMenuServices>>

const createSubmenuItems: Array<EditorContextMenuItem> = SIDEBAR_ITEM_CREATION_COMMANDS.map(
  (command) => ({
    id: `submenu-create-${command.key}`,
    commandId: sidebarItemCreationActionIds[command.id],
    label: command.label,
    icon: command.icon,
    group: 'create',
    priority: command.priority,
  }),
)

export const editorContextMenuContributors = [
  {
    id: 'editor-value-inline',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'edit-value-inline',
        commandId: 'editValueInline',
        label: 'Edit Value',
        icon: Sigma,
        group: 'primary',
        priority: 0,
        applies: (context) => p.hasEditableValueInlineId(context),
      },
    ],
  },
  {
    id: 'editor-note',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'share-blocks',
        label: getBlockShareActionLabel,
        icon: Share2,
        group: 'share',
        priority: 1,
        applies: (context, services) =>
          p.isDm(context) && p.hasBlockNoteId(context) && services.blockShare.canOpen(context),
        isEnabled: (context, services) =>
          services.blockShare.canToggleAllPlayersPermission(context),
        onSelect: (context, services) => services.blockShare.toggleAllPlayersPermission(context),
        closeOnSelect: false,
      },
    ],
  },
  {
    id: 'editor-note-clipboard',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'editor-paste',
        commandId: 'showComingSoon',
        label: 'Paste',
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
        group: 'edit',
        priority: 84,
        applies: (context) => p.isEditorTextContext(context),
      },
      {
        id: 'editor-cut',
        commandId: 'showComingSoon',
        label: 'Cut',
        icon: Scissors,
        shortcut: 'Ctrl+X',
        group: 'edit',
        priority: 85,
        applies: (context) => p.hasEditorTextSelection(context),
      },
      {
        id: 'editor-copy',
        commandId: 'showComingSoon',
        label: 'Copy',
        icon: ClipboardCopy,
        shortcut: 'Ctrl+C',
        group: 'edit',
        priority: 86,
        applies: (context) => p.hasEditorTextSelection(context),
      },
    ],
  },
  {
    id: 'editor-primary',
    surfaces: ['sidebar', 'topbar', 'folder-view', 'map-view', 'trash-view', 'note-view'],
    getItems: () => [
      {
        id: 'open',
        commandId: 'open',
        label: 'Open',
        icon: SquareArrowOutUpRight,
        group: 'primary',
        priority: 0,
        applies: (context) =>
          p.isSingleSelection(context) &&
          (p.inSidebar(context) || p.hasPinContext(context)) &&
          context.item !== undefined,
      },
      {
        id: 'go-to-map-pin',
        commandId: 'goToMapPin',
        label: 'Go to Map Pin',
        icon: Navigation,
        group: 'primary',
        priority: 1,
        applies: (context) =>
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          p.isPinnedOnActiveMap(context) &&
          p.isNotActiveMap(context),
      },
      {
        id: 'toggle-bookmark',
        commandId: 'toggleBookmark',
        label: (context) => (context.item?.isBookmarked ? 'Remove Bookmark' : 'Bookmark'),
        icon: Bookmark,
        group: 'primary',
        priority: 2,
        applies: (context) =>
          p.inView('sidebar', 'folder-view')(context) && p.isSidebarItem(context),
        isChecked: (context) => context.item?.isBookmarked ?? false,
      },
      {
        id: 'show-in-sidebar',
        commandId: 'showInSidebar',
        label: 'Show in Sidebar',
        icon: Eye,
        group: 'primary',
        priority: 3,
        applies: (context) => p.isSidebarItem(context) && p.isNotActiveMap(context),
      },
      {
        id: 'restore',
        commandId: 'restore',
        label: 'Restore',
        icon: RotateCcw,
        group: 'primary',
        priority: 4,
        applies: (context) => p.canRestoreSelectedItems(context) && p.isSidebarItem(context),
      },
    ],
  },
  {
    id: 'editor-create',
    surfaces: ['sidebar', 'folder-view'],
    getItems: () => [
      {
        id: 'create-new-submenu',
        label: 'New...',
        icon: Plus,
        group: 'create',
        priority: 5,
        applies: (context) =>
          p.hasFullAccess(context) &&
          !p.hasPinContext(context) &&
          (p.isType(SIDEBAR_ITEM_TYPES.folders)(context) || p.atRoot(context)),
        children: () => createSubmenuItems,
      },
    ],
  },
  {
    id: 'editor-pin-actions',
    surfaces: ['sidebar', 'map-view'],
    getItems: () => [
      {
        id: 'pin-to-map',
        commandId: 'pinToMap',
        label: (context) => {
          const itemCount = getUnpinnedMapItems(context).length
          return itemCount > 1 ? `Pin ${itemCount} items to Map` : 'Pin to Map'
        },
        icon: MapPin,
        group: 'pin-actions',
        priority: 1,
        applies: (context) =>
          p.allSelectedItemsHaveEditAccess(context) &&
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          getUnpinnedMapItems(context).length > 0 &&
          p.isNotActiveMap(context),
      },
      {
        id: 'toggle-pin-visibility',
        commandId: 'togglePinVisibility',
        label: (context) => (context.activePin?.visible === true ? 'Hide Pin' : 'Show Pin'),
        icon: EyeOff,
        group: 'pin-actions',
        priority: 49,
        applies: (context) => p.isDm(context) && p.hasPinContext(context),
      },
      {
        id: 'move-map-pin',
        commandId: 'moveMapPin',
        label: 'Move Pin',
        icon: Move,
        group: 'pin-actions',
        priority: 50,
        applies: (context) => p.hasEditAccess(context) && p.hasPinContext(context),
      },
      {
        id: 'remove-map-pin',
        commandId: 'removeMapPin',
        label: 'Remove Pin',
        icon: Trash2,
        group: 'pin-actions',
        priority: 51,
        variant: 'danger',
        applies: (context) => p.hasEditAccess(context) && p.hasPinContext(context),
      },
      {
        id: 'create-map-pin',
        commandId: 'createMapPin',
        label: 'Create Pin Here',
        icon: MapPin,
        group: 'pin-actions',
        priority: 52,
        applies: (context) =>
          p.hasEditAccess(context) && p.isActiveMap(context) && p.inView('map-view')(context),
      },
    ],
  },
  {
    id: 'editor-panels',
    surfaces: ['topbar'],
    getItems: () => {
      const panelItems: Array<EditorContextMenuItem> = RIGHT_SIDEBAR_PANELS.map((panel, index) => ({
        id: `panel-${panel.id}`,
        commandId: 'activatePanel',
        payload: panel.id,
        label: panel.label === 'History' ? 'Edit History' : panel.label,
        icon: panel.icon,
        group: 'panels',
        priority: 70 + index,
        applies: (context) =>
          p.isSidebarItem(context) && canShowRightSidebarContent(context.item?.type, panel.id),
        isChecked: (context) => isPanelContentActive(context, panel.id),
      }))

      return [
        {
          id: 'toggle-reading-mode',
          commandId: 'toggleReadingMode',
          label: 'Reading Mode',
          icon: BookOpen,
          group: 'panels',
          priority: 69,
          applies: (context, itemServices) =>
            p.isSidebarItem(context) && itemServices.editorMode.canEdit === true,
          isChecked: (_itemContext, itemServices) =>
            itemServices.editorMode.editorMode === EDITOR_MODE.VIEWER,
          closeOnSelect: false,
        },
        ...panelItems,
      ]
    },
  },
  {
    id: 'editor-share',
    surfaces: ['sidebar', 'folder-view', 'favorites', 'topbar'],
    getItems: (_shareContext, shareServices) => [
      {
        id: 'view-as-player',
        label: 'View as Player',
        icon: Eye,
        group: 'share',
        priority: 79,
        applies: (context, itemServices) =>
          p.inView('topbar')(context) &&
          p.isCampaignDm(context) &&
          p.isSidebarItem(context) &&
          itemServices.viewAsPlayer.playerMembers.length > 0,
        isChecked: (_itemContext, itemServices) =>
          itemServices.viewAsPlayer.viewAsPlayerId !== undefined,
        children: () => createViewAsPlayerItems(shareServices),
      },
      {
        id: 'share-items',
        label: (context) => {
          const itemCount = context.selectedItems?.length ?? 0
          return itemCount > 1 ? `Share ${itemCount} items...` : 'Share...'
        },
        icon: Share2,
        group: 'share',
        priority: 78,
        submenuContent: (context) =>
          createElement(SidebarItemsSharePanel, {
            items: context.selectedItems ?? [],
          }),
        applies: (context) =>
          p.isDm(context) &&
          p.isSidebarItem(context) &&
          p.allSelectedItemsHaveFullAccess(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          !p.hasPinContext(context),
      },
    ],
  },
  {
    id: 'editor-download',
    surfaces: ['sidebar', 'folder-view', 'topbar', 'map-view'],
    getItems: () => [
      {
        id: 'download-items',
        commandId: 'downloadItems',
        label: (context) => {
          const itemCount = context.selectedItems?.length ?? 0
          return itemCount > 1 ? `Download ${itemCount} items` : 'Download'
        },
        icon: Download,
        group: 'download',
        priority: 80,
        applies: (context) =>
          p.allSelectedItemsHaveViewAccess(context) &&
          p.isSidebarItem(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          !p.hasPinContext(context),
      },
      {
        id: 'download-all',
        commandId: 'downloadAll',
        label: 'Download All',
        icon: FolderDown,
        group: 'download',
        priority: 82,
        applies: (context) => p.atRoot(context) && p.inSidebar(context),
      },
    ],
  },
  {
    id: 'editor-clipboard',
    surfaces: ['sidebar', 'folder-view'],
    getItems: () => [
      {
        id: 'paste',
        commandId: 'paste',
        label: 'Paste',
        icon: ClipboardPaste,
        group: 'edit',
        priority: 87,
        applies: (context, services) =>
          p.inView('sidebar', 'folder-view')(context) &&
          services.filesystem.canPasteIntoTarget({
            clickedItem: context.item,
            operationItems: context.selectedItems ?? [],
          }),
      },
      {
        id: 'duplicate',
        commandId: 'duplicate',
        label: 'Duplicate',
        icon: Files,
        group: 'edit',
        priority: 88,
        applies: (context) =>
          p.hasSelection(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          p.allSelectedItemsHaveFullAccess(context),
      },
    ],
  },
  {
    id: 'editor-edit',
    surfaces: ['sidebar', 'folder-view', 'topbar'],
    getItems: () => [
      {
        id: 'rename',
        commandId: 'rename',
        label: 'Rename',
        icon: FileTypeIcon,
        group: 'edit',
        priority: 90,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.inSidebar(context) &&
          p.isItemNotTrashed(context) &&
          p.isSidebarItem(context),
      },
      {
        id: 'edit-map',
        commandId: 'editMap',
        label: 'Edit Map',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isItemNotTrashed(context) &&
          p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(context),
      },
      {
        id: 'edit-file',
        commandId: 'editFile',
        label: 'Edit File',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isItemNotTrashed(context) &&
          p.isType(SIDEBAR_ITEM_TYPES.files)(context),
      },
      {
        id: 'edit-item',
        commandId: 'editItem',
        label: (context) => `Edit ${getTypeName(context)}`,
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isSidebarItem(context) &&
          p.isItemNotTrashed(context) &&
          p.isNotType(SIDEBAR_ITEM_TYPES.gameMaps, SIDEBAR_ITEM_TYPES.files)(context),
      },
    ],
  },
  {
    id: 'editor-danger',
    surfaces: ['sidebar', 'folder-view', 'topbar', 'trash-view'],
    getItems: () => [
      {
        id: 'delete',
        commandId: 'delete',
        label: 'Move to Trash',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context) =>
          p.canTrashSelectedItems(context) &&
          p.isSidebarItem(context) &&
          (p.inView('sidebar')(context) ||
            p.inView('folder-view')(context) ||
            p.inView('topbar')(context)),
      },
      {
        id: 'permanently-delete',
        commandId: 'permanentlyDelete',
        label: 'Delete Forever',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context) => p.canDeleteSelectedItemsForever(context) && p.isSidebarItem(context),
      },
      {
        id: 'empty-trash',
        commandId: 'emptyTrash',
        label: 'Empty Trash',
        icon: Trash2,
        group: 'danger',
        priority: 101,
        variant: 'danger',
        applies: (context) => p.isTrashView(context) && p.isDm(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>

export const groupConfig: ContextMenuGroupConfig = {
  primary: { label: null, priority: 0 },
  create: { label: null, priority: 1 },
  share: { label: null, priority: 2 },
  download: { label: null, priority: 3 },
  edit: { label: null, priority: 4 },
  navigation: { label: null, priority: 5 },
  'pin-actions': { label: null, priority: 6 },
  panels: { label: null, priority: 7 },
  danger: { label: null, priority: 99 },
}
