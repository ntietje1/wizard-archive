import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import {
  Eye,
  File,
  FileEdit,
  FilePlus,
  FolderPlus,
  Grid2x2Plus,
  MapPin,
  Move,
  Navigation,
  Pause,
  Play,
  Plus,
  SquareArrowOutUpRight,
  Tags,
  Trash2,
} from 'lucide-react'
import pluralize from 'pluralize'
import * as p from './predicates'
import type { MenuContext, MenuItemDef } from './types'

export type ActionHandlers = {
  open: (ctx: MenuContext) => void
  rename: (ctx: MenuContext) => void
  delete: (ctx: MenuContext) => void
  showInSidebar: (ctx: MenuContext) => void

  createNote: (ctx: MenuContext) => void
  createFolder: (ctx: MenuContext) => void
  createTag: (ctx: MenuContext) => void
  createMap: (ctx: MenuContext) => void
  createFile: (ctx: MenuContext) => void
  createCanvas: (ctx: MenuContext) => void
  createCategory: (ctx: MenuContext) => void

  goToCategory: (ctx: MenuContext) => void
  editCategory: (ctx: MenuContext) => void

  editMap: (ctx: MenuContext) => void

  editFile: (ctx: MenuContext) => void

  editTag: (ctx: MenuContext) => void

  pinToMap: (ctx: MenuContext) => void
  goToMapPin: (ctx: MenuContext) => void

  removeMapPin: (ctx: MenuContext) => void
  moveMapPin: (ctx: MenuContext) => void

  startSession: (ctx: MenuContext) => void
  endSession: (ctx: MenuContext) => void
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
        !p.isSessionCategory(ctx) &&
        (p.isType('folders')(ctx) ||
          p.isType('tagCategories')(ctx) ||
          p.atRoot(ctx)),
      action: () => {}, // No action for submenu parent
      children: [
        // "New Tag"
        {
          id: 'submenu-create-tag',
          label: (ctx) =>
            ctx.category?.name ? pluralize.singular(ctx.category.name) : 'Tag',
          icon: Tags,
          group: 'create',
          priority: 1,
          shouldShow: (ctx) =>
            (p.isType('tagCategories')(ctx) && p.hasCategory(ctx)) ||
            (p.isType('folders')(ctx) && p.hasCategory(ctx)),
          action: actions.createTag,
        },
        // "New Category"
        {
          id: 'submenu-create-category',
          label: 'Category',
          icon: Tags,
          group: 'create',
          priority: 2,
          shouldShow: (ctx) =>
            p.atRoot(ctx) &&
            !p.isType(
              'notes',
              'folders',
              'tags',
              'tagCategories',
              'gameMaps',
              'files',
            )(ctx),
          action: actions.createCategory,
        },
        // Note, Folder, Map, Canvas
        {
          id: 'submenu-create-note',
          label: 'Note',
          icon: FilePlus,
          group: 'create',
          priority: 10,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps', 'files')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createNote,
        },
        {
          id: 'submenu-create-folder',
          label: 'Folder',
          icon: FolderPlus,
          group: 'create',
          priority: 11,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps', 'files')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createFolder,
        },
        {
          id: 'submenu-create-map',
          label: 'Map',
          icon: MapPin,
          group: 'create',
          priority: 12,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps', 'files')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createMap,
        },
        {
          id: 'submenu-create-file',
          label: 'File',
          icon: File,
          group: 'create',
          priority: 14,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps', 'files')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createFile,
        },
        {
          id: 'submenu-create-canvas',
          label: 'Canvas',
          icon: Grid2x2Plus,
          group: 'create',
          priority: 13,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps', 'files')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createCanvas,
        },
      ],
    },

    // ========== EDIT GROUP ==========
    {
      id: 'rename',
      label: 'Rename',
      icon: FileEdit,
      group: 'edit',
      priority: 20,
      shouldShow: (ctx) =>
        p.inSidebar(ctx) &&
        p.isType('notes', 'folders', 'tags', 'gameMaps', 'files')(ctx),
      action: actions.rename,
    },

    // ========== NAVIGATION GROUP ==========
    {
      id: 'show-in-sidebar',
      label: 'Show in Sidebar',
      icon: Eye,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) =>
        p.isType('notes', 'gameMaps', 'folders', 'tags', 'files')(ctx) &&
        (p.notInSidebar(ctx) || p.inView('topbar', 'folder-view')(ctx)),
      action: actions.showInSidebar,
    },

    // ========== SESSION GROUP ==========
    {
      id: 'start-session',
      label: 'Start Session',
      icon: Play,
      group: 'primary',
      priority: 1,
      shouldShow: (ctx) =>
        p.isSessionCategory(ctx) &&
        p.hasNoActiveSession(ctx) &&
        (p.inSidebar(ctx) || p.atRoot(ctx) || p.isType('folders')(ctx)),
      action: actions.startSession,
    },
    {
      id: 'end-session',
      label: 'End Session',
      icon: Pause,
      group: 'primary',
      priority: 1,
      shouldShow: (ctx) =>
        p.isSessionCategory(ctx) &&
        p.hasActiveSession(ctx) &&
        (p.inSidebar(ctx) || p.atRoot(ctx) || p.isType('folders')(ctx)),
      action: actions.endSession,
    },

    // ========== TYPE-SPECIFIC GROUP ==========
    {
      id: 'edit-map',
      label: 'Edit Map',
      icon: FileEdit,
      group: 'type-specific',
      priority: 40,
      shouldShow: (ctx) => p.isType('gameMaps')(ctx),
      action: actions.editMap,
    },
    {
      id: 'edit-file',
      label: 'Edit File',
      icon: FileEdit,
      group: 'type-specific',
      priority: 41,
      shouldShow: (ctx) => p.isType('files')(ctx),
      action: actions.editFile,
    },
    {
      id: 'edit-category',
      label: 'Edit Category',
      icon: FileEdit,
      group: 'type-specific',
      priority: 42,
      shouldShow: (ctx) => p.isType('tagCategories')(ctx) && p.hasCategory(ctx),
      action: actions.editCategory,
    },
    {
      id: 'edit-tag',
      label: (ctx) =>
        ctx.category?.name
          ? `Edit ${pluralize.singular(ctx.category.name)}`
          : 'Edit Tag',
      icon: FileEdit,
      group: 'type-specific',
      priority: 43,
      shouldShow: (ctx) => p.isType('tags')(ctx) && p.hasCategory(ctx),
      action: actions.editTag,
    },

    // ========== PIN ACTIONS GROUP ==========
    {
      id: 'pin-to-map',
      label: 'Pin to Map',
      icon: MapPin,
      group: 'pin-actions',
      priority: 1,
      shouldShow: (ctx) =>
        p.inSidebar(ctx) &&
        p.hasActiveMap(ctx) &&
        !p.isType('tagCategories')(ctx) &&
        p.isType('notes', 'gameMaps', 'folders', 'tags')(ctx) &&
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
        p.hasActiveMap(ctx) &&
        !p.isType('tagCategories')(ctx) &&
        p.isType('notes', 'gameMaps', 'folders', 'tags')(ctx) &&
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
      shouldShow: (ctx) =>
        p.hasPinContext(ctx) && ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
      action: actions.moveMapPin,
    },
    {
      id: 'remove-map-pin',
      label: 'Remove Pin',
      icon: Trash2,
      group: 'pin-actions',
      priority: 51,
      variant: 'danger',
      shouldShow: (ctx) =>
        p.hasPinContext(ctx) && ctx.memberRole === CAMPAIGN_MEMBER_ROLE.DM,
      action: actions.removeMapPin,
    },

    // ========== DANGER GROUP ==========
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      group: 'danger',
      priority: 100,
      variant: 'danger',
      shouldShow: (ctx) =>
        (p.inSidebar(ctx) || p.inView('folder-view')(ctx)) &&
        p.isType('notes', 'folders', 'tags', 'gameMaps', 'files')(ctx),
      action: actions.delete,
    },
  ]
}

export const groupConfig = {
  primary: { label: null, priority: 0 },
  create: { label: null, priority: 1 },
  edit: { label: null, priority: 2 },
  navigation: { label: null, priority: 3 },
  'type-specific': { label: null, priority: 4 },
  'pin-actions': { label: null, priority: 5 },
  danger: { label: null, priority: 99 },
}
