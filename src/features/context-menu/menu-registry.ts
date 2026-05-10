import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { PermissionLevel } from 'convex/permissions/types'
import { createElement } from 'react'
import {
  ArrowUpLeft,
  ArrowUpRight,
  Bookmark,
  Download,
  ClipboardPaste,
  Eye,
  EyeOff,
  File,
  FileEdit,
  FilePlus,
  FileTypeIcon,
  Files,
  FolderDown,
  FolderPlus,
  Grid2x2Plus,
  History,
  List,
  MapPin,
  Move,
  Navigation,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import * as p from './predicates'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  ContextMenuGroupConfig,
  ContextMenuItemSpec,
  EditorMenuContext,
} from './types'
import { resolveContextOperationItems } from './selection-context'
import {
  RIGHT_SIDEBAR_CONTENT,
  RIGHT_SIDEBAR_PANEL_ID,
} from '~/features/editor/components/right-sidebar/constants'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import { logger } from '~/shared/utils/logger'
import { assertNever } from '~/shared/utils/utils'
import { SidebarItemsSharePanel } from '~/features/sharing/components/sidebar-items-share-panel'

function isPanelContentActive(contentId: string): boolean {
  const panel = usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]
  return panel?.visible === true && panel?.activeContentId === contentId
}

function activatePanelContent(contentId: string): void {
  const store = usePanelPreferenceStore.getState()
  store.setActiveContent(RIGHT_SIDEBAR_PANEL_ID, contentId)
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
  return resolveContextOperationItems(context).filter(
    (item) => item._id !== context.activeMap?._id && !pinnedItemIds.has(item._id),
  )
}

export type ActionHandlers = {
  open: (context: EditorMenuContext) => void
  rename: (context: EditorMenuContext) => void
  delete: (context: EditorMenuContext) => void
  showInSidebar: (context: EditorMenuContext) => void
  createNote: (context: EditorMenuContext) => void
  createFolder: (context: EditorMenuContext) => void
  createMap: (context: EditorMenuContext) => void
  createFile: (context: EditorMenuContext) => void
  createCanvas: (context: EditorMenuContext) => void
  editMap: (context: EditorMenuContext) => void
  editFile: (context: EditorMenuContext) => void
  editItem: (context: EditorMenuContext) => void
  pinToMap: (context: EditorMenuContext) => void
  goToMapPin: (context: EditorMenuContext) => void
  createMapPin: (context: EditorMenuContext) => void
  removeMapPin: (context: EditorMenuContext) => void
  moveMapPin: (context: EditorMenuContext) => void
  togglePinVisibility: (context: EditorMenuContext) => void
  startSession: (context: EditorMenuContext) => void
  endSession: (context: EditorMenuContext) => void
  setGeneralAccessLevel: (context: EditorMenuContext, level: PermissionLevel | null) => void
  downloadItems: (context: EditorMenuContext) => void
  downloadAll: (context: EditorMenuContext) => void
  toggleBookmark: (context: EditorMenuContext) => void
  paste: (context: EditorMenuContext) => void
  duplicate: (context: EditorMenuContext) => void
  restore: (context: EditorMenuContext) => void
  permanentlyDelete: (context: EditorMenuContext) => void
  emptyTrash: (context: EditorMenuContext) => void
}

export interface EditorContextMenuServices {
  actions: ActionHandlers
}

type EditorContextMenuItem = ContextMenuItemSpec<EditorMenuContext, EditorContextMenuServices>
type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

type SimpleActionKey = Exclude<keyof ActionHandlers, 'setGeneralAccessLevel'>

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
    run: (_context, _services, payload) => {
      if (typeof payload !== 'string') {
        logger.warn('activatePanel received invalid payload', payload)
        return
      }
      activatePanelContent(payload)
    },
  },
  logTestEditor: {
    id: 'logTestEditor',
    run: (context) => {
      logger.debug('test-editor', context)
    },
  },
  logTestBlock: {
    id: 'logTestBlock',
    run: (context) => {
      logger.debug('test-block', context.blockNoteId)
      if (!context.blockNoteId) return
      const block = context.editor?.getBlock(context.blockNoteId)
      logger.debug(block?.content)
    },
  },
} satisfies Record<string, ContextMenuCommand<EditorMenuContext, EditorContextMenuServices>>

const createSubmenuItems: Array<EditorContextMenuItem> = [
  {
    id: 'submenu-create-note',
    commandId: 'createNote',
    label: 'Note',
    icon: FilePlus,
    group: 'create',
    priority: 10,
  },
  {
    id: 'submenu-create-folder',
    commandId: 'createFolder',
    label: 'Folder',
    icon: FolderPlus,
    group: 'create',
    priority: 11,
  },
  {
    id: 'submenu-create-map',
    commandId: 'createMap',
    label: 'Map',
    icon: MapPin,
    group: 'create',
    priority: 12,
  },
  {
    id: 'submenu-create-canvas',
    commandId: 'createCanvas',
    label: 'Canvas',
    icon: Grid2x2Plus,
    group: 'create',
    priority: 13,
  },
  {
    id: 'submenu-create-file',
    commandId: 'createFile',
    label: 'File',
    icon: File,
    group: 'create',
    priority: 14,
  },
]

export const editorContextMenuContributors = [
  {
    id: 'editor-tests',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'test-editor',
        commandId: 'logTestEditor',
        label: 'Test Editor',
        icon: Pencil,
        group: 'primary',
        priority: 0,
        applies: (context) => p.hasBlockNoteEditor(context),
      },
      {
        id: 'test-block',
        commandId: 'logTestBlock',
        label: 'Test Block',
        icon: Pencil,
        group: 'primary',
        priority: 1,
        applies: (context) => p.hasBlockNoteId(context),
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
        applies: (context) => p.allSelectedItemsTrashed(context) && p.isSidebarItem(context),
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
    getItems: () => [
      {
        id: 'panel-history',
        commandId: 'activatePanel',
        payload: RIGHT_SIDEBAR_CONTENT.history,
        label: 'Edit History',
        icon: History,
        group: 'panels',
        priority: 70,
        applies: (context) => p.isSidebarItem(context),
        isChecked: () => isPanelContentActive(RIGHT_SIDEBAR_CONTENT.history),
      },
      {
        id: 'panel-backlinks',
        commandId: 'activatePanel',
        payload: RIGHT_SIDEBAR_CONTENT.backlinks,
        label: 'Back Links',
        icon: ArrowUpLeft,
        group: 'panels',
        priority: 71,
        applies: (context) => p.isSidebarItem(context),
        isChecked: () => isPanelContentActive(RIGHT_SIDEBAR_CONTENT.backlinks),
      },
      {
        id: 'panel-outgoing',
        commandId: 'activatePanel',
        payload: RIGHT_SIDEBAR_CONTENT.outgoing,
        label: 'Outgoing Links',
        icon: ArrowUpRight,
        group: 'panels',
        priority: 72,
        applies: (context) => p.isSidebarItem(context),
        isChecked: () => isPanelContentActive(RIGHT_SIDEBAR_CONTENT.outgoing),
      },
      {
        id: 'panel-outline',
        commandId: 'activatePanel',
        payload: RIGHT_SIDEBAR_CONTENT.outline,
        label: 'Outline',
        icon: List,
        group: 'panels',
        priority: 73,
        applies: (context) => p.isSidebarItem(context),
        isChecked: () => isPanelContentActive(RIGHT_SIDEBAR_CONTENT.outline),
      },
    ],
  },
  {
    id: 'editor-share',
    surfaces: ['sidebar', 'folder-view', 'favorites', 'topbar'],
    getItems: () => [
      {
        id: 'share-items',
        label: (context) => {
          const itemCount = resolveContextOperationItems(context).length
          return itemCount > 1 ? `Share ${itemCount} items...` : 'Share...'
        },
        icon: Share2,
        group: 'share',
        priority: 78,
        submenuContent: (context) =>
          createElement(SidebarItemsSharePanel, {
            items: resolveContextOperationItems(context),
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
          const itemCount = resolveContextOperationItems(context).length
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
        applies: (context) =>
          p.canWrite(context) &&
          p.inView('sidebar', 'folder-view')(context) &&
          (p.atRoot(context) || p.isType(SIDEBAR_ITEM_TYPES.folders)(context)),
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
          p.allSelectedItemsHaveFullAccess(context) &&
          p.isSidebarItem(context) &&
          p.allSelectedItemsNotTrashed(context) &&
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
        applies: (context) => p.allSelectedItemsTrashed(context) && p.isSidebarItem(context),
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
