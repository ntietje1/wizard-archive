import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import {
  SIDEBAR_ITEM_SHARE_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/types'
import {
  Download,
  Eye,
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
  Plus,
  Share2,
  SquareArrowOutUpRight,
  Trash2,
} from 'lucide-react'
import * as p from './predicates'
import type { MenuContext, MenuItemDef } from './types'
import type { Id } from 'convex/_generated/dataModel'

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
      return 'Item'
  }
}

// Helper to check if shared with ALL players based on shareStatus enum
function isSharedWithAll(ctx: MenuContext): boolean {
  const shareState = ctx.shareState
  if (!shareState) return false
  return shareState.shareStatus === SIDEBAR_ITEM_SHARE_STATUS.ALL_SHARED
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

  removeMapPin: (ctx: MenuContext) => void
  moveMapPin: (ctx: MenuContext) => void

  startSession: (ctx: MenuContext) => void
  endSession: (ctx: MenuContext) => void

  // Share actions
  toggleShareWithAll: (ctx: MenuContext) => void
  toggleShareWithMember: (
    ctx: MenuContext,
    memberId: Id<'campaignMembers'>,
  ) => void

  // Download actions
  downloadFile: (ctx: MenuContext) => void
  downloadNote: (ctx: MenuContext) => void
  downloadMap: (ctx: MenuContext) => void
  downloadFolder: (ctx: MenuContext) => void
  downloadAll: (ctx: MenuContext) => void
}

export function createMenuItems(actions: ActionHandlers): Array<MenuItemDef> {
  return [
    // ========== PRIMARY GROUP ==========
    {
      id: 'open',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.inSidebar(ctx) && ctx.item !== undefined,
      action: actions.open,
    },

    // ========== CREATE GROUP ==========
    {
      id: 'create-new-submenu',
      label: 'New...',
      icon: Plus,
      group: 'create',
      priority: 5,
      shouldShow: (ctx) =>
        !p.inView('topbar')(ctx) &&
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

    // ========== SHARE GROUP ==========
    {
      id: 'share-item',
      label: (ctx) => {
        // Only say "Unshare" if shared with ALL players
        if (isSharedWithAll(ctx)) {
          return `Unshare...`
        }
        return `Share...`
      },
      icon: Share2,
      group: 'share',
      variant: 'share',
      priority: 20,
      shouldShow: (ctx) =>
        ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM &&
        p.isSidebarItem(ctx) &&
        p.isNotType(SIDEBAR_ITEM_TYPES.folders)(ctx),
      isDisabled: (ctx) => ctx.shareState?.isLoading ?? false,
      action: actions.toggleShareWithAll,
      // Dynamic children for individual player sharing (empty = no submenu)
      children: (ctx): Array<MenuItemDef> => {
        const shareState = ctx.shareState
        if (!shareState || shareState.playerMembers.length === 0) {
          return []
        }

        const allPlayersItem: MenuItemDef = {
          id: 'share-all-players',
          label: 'All Players',
          group: 'share',
          priority: 0,
          shouldShow: p.always,
          isChecked: () => isSharedWithAll(ctx),
          action: actions.toggleShareWithAll,
        }

        const playerItems: Array<MenuItemDef> = shareState.playerMembers.map(
          (member) => {
            const profile = member.userProfile
            const displayText = profile.name
              ? profile.name
              : profile.username
                ? `@${profile.username}`
                : 'Player'

            // Check if shared with this member based on shareStatus
            const isShared =
              shareState.shareStatus === SIDEBAR_ITEM_SHARE_STATUS.ALL_SHARED ||
              (shareState.shareStatus ===
                SIDEBAR_ITEM_SHARE_STATUS.INDIVIDUALLY_SHARED &&
                shareState.sharedMemberIds.has(member._id))

            return {
              id: `share-player-${member._id}`,
              label: displayText,
              group: 'share',
              priority: 1,
              shouldShow: p.always,
              isChecked: () => isShared,
              action: () => actions.toggleShareWithMember(ctx, member._id),
            }
          },
        )

        return [allPlayersItem, ...playerItems]
      },
    },

    // ========== NAVIGATION GROUP ==========
    {
      id: 'show-in-sidebar',
      label: 'Show in Sidebar',
      icon: Eye,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.isSidebarItem(ctx) && p.notInSidebar(ctx),
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
        p.inSidebar(ctx) &&
        p.isSidebarItem(ctx) &&
        !p.isPinnedOnActiveMap(ctx) &&
        p.mapIsNotActiveMap(ctx),
      action: actions.pinToMap,
    },
    {
      id: 'go-to-map-pin',
      label: 'Go to Map Pin',
      icon: Navigation,
      group: 'pin-actions',
      priority: 1,
      shouldShow: (ctx) =>
        p.inSidebar(ctx) &&
        p.isSidebarItem(ctx) &&
        p.isPinnedOnActiveMap(ctx) &&
        p.mapIsNotActiveMap(ctx),
      action: actions.goToMapPin,
    },
    {
      id: 'move-map-pin',
      label: 'Move Pin',
      icon: Move,
      group: 'pin-actions',
      priority: 50,
      shouldShow: (
        ctx, // TODO: these are broken
      ) => p.hasPinContext(ctx) && ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
      action: actions.moveMapPin,
    },
    {
      id: 'remove-map-pin',
      label: 'Remove Pin',
      icon: Trash2,
      group: 'pin-actions',
      priority: 51,
      variant: 'danger',
      shouldShow: (
        ctx, // TODO: these are broken
      ) => p.hasPinContext(ctx) && ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
      action: actions.removeMapPin,
    },

    // ========== DOWNLOAD GROUP ==========
    {
      id: 'download-file',
      label: 'Download',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) && p.isType(SIDEBAR_ITEM_TYPES.files)(ctx),
      action: actions.downloadFile,
    },
    {
      id: 'download-note',
      label: 'Download',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) && p.isType(SIDEBAR_ITEM_TYPES.notes)(ctx),
      action: actions.downloadNote,
    },
    {
      id: 'download-map',
      label: 'Download',
      icon: Download,
      group: 'download',
      priority: 80,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) && p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(ctx),
      action: actions.downloadMap,
    },
    {
      id: 'download-folder',
      label: 'Download',
      icon: FolderDown,
      group: 'download',
      priority: 81,
      shouldShow: (ctx) =>
        p.isSidebarItem(ctx) && p.isType(SIDEBAR_ITEM_TYPES.folders)(ctx),
      action: actions.downloadFolder,
    },
    {
      id: 'download-all',
      label: 'Download All',
      icon: FolderDown,
      group: 'download',
      priority: 82,
      shouldShow: (ctx) => p.atRoot(ctx),
      action: actions.downloadAll,
    },

    // ========== EDIT GROUP ==========
    {
      id: 'rename',
      label: 'Rename',
      icon: FileTypeIcon,
      group: 'edit',
      priority: 90,
      shouldShow: (ctx) => p.inSidebar(ctx) && p.isSidebarItem(ctx),
      action: actions.rename,
    },
    {
      id: 'edit-map',
      label: 'Edit Map',
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        !p.inSidebar(ctx) && p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(ctx),
      action: actions.editMap,
    },
    {
      id: 'edit-file',
      label: 'Edit File',
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        !p.inSidebar(ctx) && p.isType(SIDEBAR_ITEM_TYPES.files)(ctx),
      action: actions.editFile,
    },
    {
      id: 'edit-item',
      label: (ctx) => `Edit ${getTypeName(ctx)}`,
      icon: FileEdit,
      group: 'edit',
      priority: 99,
      shouldShow: (ctx) =>
        !p.inSidebar(ctx) &&
        p.isNotType(SIDEBAR_ITEM_TYPES.gameMaps, SIDEBAR_ITEM_TYPES.files)(ctx),
      action: actions.editItem,
    },

    // ========== DANGER GROUP ==========
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      group: 'danger',
      priority: 100,
      variant: 'danger',
      shouldShow: (ctx) => p.isSidebarItem(ctx),
      action: actions.delete,
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
