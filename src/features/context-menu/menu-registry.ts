import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import {
  Bookmark,
  Download,
  Eye,
  EyeOff,
  File,
  FileEdit,
  FilePlus,
  FileTypeIcon,
  FolderDown,
  FolderPlus,
  Grid2x2Plus,
  MapPin,
  Move,
  Navigation,
  Pencil,
  Plus,
  RotateCcw,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import * as p from './predicates'
import type { MenuContext, MenuItemDef } from './types'
import type { PermissionLevel } from 'convex/permissions/types'
import { assertNever } from '~/features/shared/utils/utils'

// Helper to get a friendly type name for the item
function getTypeName(ctx: MenuContext): string {
  if (!ctx.item) return 'Item'
  switch (ctx.item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    default:
      return assertNever(ctx.item)
  }
}

export type ActionHandlers = {
  open: (ctx: MenuContext) => void
  rename: (ctx: MenuContext) => void
  delete: (ctx: MenuContext) => void
  showInSidebar: (ctx: MenuContext) => void

  createNote: (ctx: MenuContext) => void
  createFolder: (ctx: MenuContext) => void
  createMap: (ctx: MenuContext) => void
  createFile: (ctx: MenuContext) => void
  createCanvas: (ctx: MenuContext) => void

  editMap: (ctx: MenuContext) => void
  editFile: (ctx: MenuContext) => void
  editItem: (ctx: MenuContext) => void

  pinToMap: (ctx: MenuContext) => void
  goToMapPin: (ctx: MenuContext) => void
  createMapPin: (ctx: MenuContext) => void

  removeMapPin: (ctx: MenuContext) => void
  moveMapPin: (ctx: MenuContext) => void
  togglePinVisibility: (ctx: MenuContext) => void

  startSession: (ctx: MenuContext) => void
  endSession: (ctx: MenuContext) => void

  // Share actions
  setGeneralAccessLevel: (
    ctx: MenuContext,
    level: PermissionLevel | null,
  ) => void

  // Download actions
  downloadFile: (ctx: MenuContext) => void
  downloadNote: (ctx: MenuContext) => void
  downloadMap: (ctx: MenuContext) => void
  downloadFolder: (ctx: MenuContext) => void
  downloadAll: (ctx: MenuContext) => void

  // Bookmark actions
  toggleBookmark: (ctx: MenuContext) => void

  // Trash actions
  restore: (ctx: MenuContext) => void
  permanentlyDelete: (ctx: MenuContext) => void
  emptyTrash: (ctx: MenuContext) => void
}

export function createMenuItems(actions: ActionHandlers): Array<MenuItemDef> {
  return [
    // ========== PRIMARY GROUP ==========
    {
      id: 'test-editor',
      label: 'Test Editor',
      icon: Pencil,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.hasBlockNoteEditor(ctx),
      action: (ctx) => {
        console.log('test-editor', ctx)
      },
    },
    {
      id: 'test-block',
      label: 'Test Block',
      icon: Pencil,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.hasBlockId(ctx),
      action: (ctx) => {
        console.log('test-block', ctx.blockId)
        if (!ctx.blockId) return
        const block = ctx.editor?.getBlock(ctx.blockId)
        console.log(block?.content)
      },
    },
    {
      id: 'open',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) =>
        (p.inSidebar(ctx) || p.hasPinContext(ctx)) && ctx.item !== undefined,
      action: actions.open,
    },
    {
      id: 'go-to-map-pin',
      label: 'Go to Map Pin',
      icon: Navigation,
      group: 'primary',
      priority: 1,
      shouldShow: (
        ctx, // TODO: check view access on both item and map
      ) =>
        p.inSidebar(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isPinnedOnActiveMap(ctx) &&
        p.isNotActiveMap(ctx),
      action: actions.goToMapPin,
    },
    {
      id: 'toggle-bookmark',
      label: (ctx) => (ctx.item?.isBookmarked ? 'Remove Bookmark' : 'Bookmark'),
      icon: Bookmark,
      group: 'primary',
      priority: 2,
      shouldShow: (ctx) => p.inSidebar(ctx) && p.isSidebarItem(ctx),
      isChecked: (ctx) => ctx.item?.isBookmarked ?? false,
      action: actions.toggleBookmark,
    },

    // ========== CREATE GROUP ==========
    {
      id: 'create-new-submenu',
      label: 'New...',
      icon: Plus,
      group: 'create',
      priority: 5,
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        !p.inView('topbar')(ctx) &&
        !p.hasPinContext(ctx) &&
        (p.isType(SIDEBAR_ITEM_TYPES.folders)(ctx) || p.atRoot(ctx)),
      action: () => {}, // No action for submenu parent
      children: [
        // Note, Folder, Map, Canvas
        {
          id: 'submenu-create-note',
          label: 'Note',
          icon: FilePlus,
          group: 'create',
          priority: 10,
          shouldShow: p.always,
          action: actions.createNote,
        },
        {
          id: 'submenu-create-folder',
          label: 'Folder',
          icon: FolderPlus,
          group: 'create',
          priority: 11,
          shouldShow: p.always,
          action: actions.createFolder,
        },
        {
          id: 'submenu-create-map',
          label: 'Map',
          icon: MapPin,
          group: 'create',
          priority: 12,
          shouldShow: p.always,
          action: actions.createMap,
        },
        {
          id: 'submenu-create-file',
          label: 'File',
          icon: File,
          group: 'create',
          priority: 14,
          shouldShow: p.always,
          action: actions.createFile,
        },
        {
          id: 'submenu-create-canvas',
          label: 'Canvas',
          icon: Grid2x2Plus,
          group: 'create',
          priority: 13,
          shouldShow: p.always,
          action: actions.createCanvas,
        },
      ],
    },

    // // ========== SHARE GROUP ==========
    // {
    //   id: 'share-item',
    //   label: 'Share...',
    //   icon: Share2,
    //   group: 'share',
    //   variant: 'share',
    //   priority: 20,
    //   shouldShow: (ctx) => p.isDm(ctx) && p.isSidebarItem(ctx),
    //   isDisabled: (ctx) => ctx.shareState?.isLoading ?? false,
    //   action: () => {},
    //   children: (ctx): Array<MenuItemDef> => {
    //     const shareState = ctx.shareState
    //     if (!shareState) return []

    //     const currentLevel = shareState.allPermissionLevel
    //     const inheritedLevel = shareState.inheritedAllPermissionLevel
    //     const hasInherited = inheritedLevel !== undefined

    //     const PERMISSION_LABELS: Record<string, string> = {
    //       none: 'None',
    //       view: 'View',
    //       edit: 'Edit',
    //       full_access: 'Full access',
    //     }

    //     const items: Array<MenuItemDef> = []

    //     if (hasInherited) {
    //       const inheritedLabel = PERMISSION_LABELS[inheritedLevel] ?? 'None'
    //       items.push({
    //         id: 'general-access-default',
    //         label: `Default (${inheritedLabel})`,
    //         group: 'share',
    //         priority: 0,
    //         shouldShow: p.always,
    //         isChecked: () => currentLevel === undefined,
    //         action: () => actions.setGeneralAccessLevel(ctx, undefined),
    //       })
    //     }

    //     const levels: Array<{ key: string; level: PermissionLevel }> = [
    //       { key: 'none', level: 'none' },
    //       { key: 'view', level: 'view' },
    //       { key: 'edit', level: 'edit' },
    //       { key: 'full_access', level: 'full_access' },
    //     ]

    //     for (const { key, level } of levels) {
    //       items.push({
    //         id: `general-access-${key}`,
    //         label: PERMISSION_LABELS[key],
    //         group: 'share',
    //         priority: items.length,
    //         shouldShow: p.always,
    //         isChecked: () => currentLevel === level,
    //         action: () => actions.setGeneralAccessLevel(ctx, level),
    //       })
    //     }

    //     return items
    //   },
    // },

    // ========== NAVIGATION GROUP ==========
    {
      id: 'show-in-sidebar',
      label: 'Show in Sidebar',
      icon: Eye,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.isSidebarItem(ctx) && p.isNotActiveMap(ctx),
      action: actions.showInSidebar,
    },

    // // ========== SESSION GROUP ==========
    // {
    //   id: 'start-session',
    //   label: 'Start Session',
    //   icon: Play,
    //   group: 'primary',
    //   priority: 1,
    //   shouldShow: (ctx) =>
    //     p.hasNoActiveSession(ctx) &&
    //     p.atRoot(ctx) &&
    //     ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
    //   action: actions.startSession,
    // },
    // {
    //   id: 'end-session',
    //   label: 'End Session',
    //   icon: Pause,
    //   group: 'primary',
    //   priority: 1,
    //   shouldShow: (ctx) =>
    //     p.hasActiveSession(ctx) &&
    //     p.atRoot(ctx) &&
    //     ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
    //   action: actions.endSession,
    // },

    // ========== PIN ACTIONS GROUP ==========
    {
      id: 'pin-to-map',
      label: 'Pin to Map',
      icon: MapPin,
      group: 'pin-actions',
      priority: 1,
      shouldShow: (ctx) =>
        p.hasEditAccess(ctx) &&
        p.inSidebar(ctx) &&
        p.isSidebarItem(ctx) &&
        !p.isPinnedOnActiveMap(ctx) &&
        p.isNotActiveMap(ctx),
      action: actions.pinToMap,
    },
    {
      id: 'toggle-pin-visibility',
      label: (ctx) =>
        ctx.activePin?.visible === true ? 'Hide Pin' : 'Show Pin',
      icon: EyeOff,
      group: 'pin-actions',
      priority: 49,
      shouldShow: (ctx) => p.isDm(ctx) && p.hasPinContext(ctx),
      action: actions.togglePinVisibility,
    },
    {
      id: 'move-map-pin',
      label: 'Move Pin',
      icon: Move,
      group: 'pin-actions',
      priority: 50,
      shouldShow: (ctx) => p.hasEditAccess(ctx) && p.hasPinContext(ctx),
      action: actions.moveMapPin,
    },
    {
      id: 'remove-map-pin',
      label: 'Remove Pin',
      icon: Trash2,
      group: 'pin-actions',
      priority: 51,
      variant: 'danger',
      shouldShow: (ctx) => p.hasEditAccess(ctx) && p.hasPinContext(ctx),
      action: actions.removeMapPin,
    },
    {
      id: 'create-map-pin',
      label: 'Create Pin Here',
      icon: MapPin,
      group: 'pin-actions',
      priority: 52,
      shouldShow: (ctx) =>
        p.hasEditAccess(ctx) && p.isActiveMap(ctx) && p.inView('map-view')(ctx),
      action: actions.createMapPin,
    },

    // ========== DOWNLOAD GROUP ==========
    {
      id: 'download-file',
      label: 'Download',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.files)(ctx) &&
        !p.hasPinContext(ctx),
      action: actions.downloadFile,
    },
    {
      id: 'download-note',
      label: 'Download',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.hasViewAccess(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.notes)(ctx) &&
        !p.hasMapContext(ctx),
      action: actions.downloadNote,
    },
    {
      id: 'download-map',
      label: 'Download Map Image',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(ctx) &&
        !p.hasMapContext(ctx),
      action: actions.downloadMap,
    },
    {
      id: 'download-folder',
      label: 'Download',
      icon: FolderDown,
      group: 'download',
      priority: 81,
      shouldShow: (ctx) =>
        p.hasViewAccess(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.folders)(ctx) &&
        !p.hasMapContext(ctx),
      action: actions.downloadFolder,
    },
    {
      id: 'download-all',
      label: 'Download All',
      icon: FolderDown,
      group: 'download',
      priority: 82,
      shouldShow: (ctx) => p.atRoot(ctx) && p.inSidebar(ctx),
      action: actions.downloadAll,
    },

    // ========== EDIT GROUP ==========
    {
      id: 'rename',
      label: 'Rename',
      icon: FileTypeIcon,
      group: 'edit',
      priority: 90,
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        p.inSidebar(ctx) &&
        p.isItemNotTrashed(ctx) &&
        p.isSidebarItem(ctx),
      action: actions.rename,
    },
    {
      id: 'edit-map',
      label: 'Edit Map',
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        p.isItemNotTrashed(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(ctx),
      action: actions.editMap,
    },
    {
      id: 'edit-file',
      label: 'Edit File',
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        p.isItemNotTrashed(ctx) &&
        p.isType(SIDEBAR_ITEM_TYPES.files)(ctx),
      action: actions.editFile,
    },
    {
      id: 'edit-item',
      label: (ctx) => `Edit ${getTypeName(ctx)}`,
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isItemNotTrashed(ctx) &&
        p.isNotType(SIDEBAR_ITEM_TYPES.gameMaps, SIDEBAR_ITEM_TYPES.files)(ctx),
      action: actions.editItem,
    },

    // ========== DANGER GROUP ==========
    {
      id: 'delete',
      label: 'Move to Trash',
      icon: Trash2,
      group: 'danger',
      priority: 100,
      variant: 'danger',
      shouldShow: (ctx) =>
        p.hasFullAccess(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isItemNotTrashed(ctx) &&
        (p.inView('sidebar')(ctx) ||
          p.inView('folder-view')(ctx) ||
          p.inView('topbar')(ctx)),
      action: actions.delete,
    },

    // ========== TRASH VIEW ACTIONS ==========
    {
      id: 'restore',
      label: 'Restore',
      icon: RotateCcw,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.isItemTrashed(ctx) && p.isSidebarItem(ctx),
      action: actions.restore,
    },
    {
      id: 'permanently-delete',
      label: 'Delete Forever',
      icon: Trash2,
      group: 'danger',
      priority: 100,
      variant: 'danger',
      shouldShow: (ctx) => p.isItemTrashed(ctx) && p.isSidebarItem(ctx),
      action: actions.permanentlyDelete,
    },
    {
      id: 'empty-trash',
      label: 'Empty Trash',
      icon: Trash2,
      group: 'danger',
      priority: 101,
      variant: 'danger',
      shouldShow: (ctx) => p.isTrashView(ctx) && p.isDm(ctx),
      action: actions.emptyTrash,
    },
  ]
}

export const groupConfig = {
  primary: { label: null, priority: 0 },
  create: { label: null, priority: 1 },
  share: { label: null, priority: 2 },
  download: { label: null, priority: 3 },
  edit: { label: null, priority: 4 },
  navigation: { label: null, priority: 5 },
  'pin-actions': { label: null, priority: 6 },
  danger: { label: null, priority: 99 },
}
