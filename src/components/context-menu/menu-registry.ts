import type { MenuItemDef, MenuContext } from './types'
import * as p from './predicates'
import {
  FilePlus,
  FolderPlus,
  FileEdit,
  Trash2,
  Eye,
  Tags,
  Grid2x2Plus,
  MapPin,
  SquareArrowOutUpRight,
  Plus,
  Navigation,
} from 'lucide-react'
import pluralize from 'pluralize'

export type ActionHandlers = {
  open: (ctx: MenuContext) => void
  rename: (ctx: MenuContext) => void
  delete: (ctx: MenuContext) => void
  showInSidebar: (ctx: MenuContext) => void

  createNote: (ctx: MenuContext) => void
  createFolder: (ctx: MenuContext) => void
  createTag: (ctx: MenuContext) => void
  createMap: (ctx: MenuContext) => void
  createCanvas: (ctx: MenuContext) => void
  createCategory: (ctx: MenuContext) => void

  createPageNote: (ctx: MenuContext) => void
  createPageMap: (ctx: MenuContext) => void

  goToCategory: (ctx: MenuContext) => void
  editCategory: (ctx: MenuContext) => void

  editMap: (ctx: MenuContext) => void

  editTag: (ctx: MenuContext) => void

  pinToMap: (ctx: MenuContext) => void
  goToMapPin: (ctx: MenuContext) => void
}

export function createMenuItems(actions: ActionHandlers): MenuItemDef[] {
  return [
    // ========== PRIMARY GROUP ==========
    {
      id: 'open',
      label: 'Open',
      icon: SquareArrowOutUpRight,
      group: 'primary',
      priority: 0,
      shouldShow: (ctx) => p.inSidebar(ctx),
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
            !p.isType('notes', 'tags', 'gameMaps')(ctx) &&
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
            !p.isType('notes', 'tags', 'gameMaps')(ctx) &&
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
            !p.isType('notes', 'tags', 'gameMaps')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createMap,
        },
        {
          id: 'submenu-create-canvas',
          label: 'Canvas',
          icon: Grid2x2Plus,
          group: 'create',
          priority: 13,
          shouldShow: (ctx) =>
            !p.isType('notes', 'tags', 'gameMaps')(ctx) &&
            (p.isType('folders')(ctx) ||
              p.isType('tagCategories')(ctx) ||
              p.atRoot(ctx)),
          action: actions.createCanvas,
        },
      ],
    },
    {
      id: 'create-new-page-submenu',
      label: 'New page...',
      icon: Plus,
      group: 'create',
      priority: 6,
      shouldShow: (ctx) =>
        p.inSidebar(ctx) &&
        (p.isType('notes')(ctx) || p.isType('tags')(ctx)),
      action: () => {}, // No action for submenu parent
      children: [
        {
          id: 'submenu-create-page-note',
          label: 'Note',
          icon: FilePlus,
          group: 'create',
          priority: 1,
          shouldShow: () => true, // Always show in submenu
          action: actions.createPageNote,
        },
        {
          id: 'submenu-create-page-map',
          label: 'Map',
          icon: MapPin,
          group: 'create',
          priority: 2,
          shouldShow: () => true, // Always show in submenu
          action: actions.createPageMap,
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
        p.isType('notes', 'folders', 'tags', 'gameMaps')(ctx),
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
        p.isType('notes', 'gameMaps', 'folders', 'tags')(ctx) &&
        (p.notInSidebar(ctx) || p.inView('topbar')(ctx)),
      action: actions.showInSidebar,
    },
    {
      id: 'pin-to-map',
      label: 'Pin to Map',
      icon: MapPin,
      group: 'primary',
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
      group: 'primary',
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
      id: 'edit-category',
      label: 'Edit Category',
      icon: FileEdit,
      group: 'type-specific',
      priority: 41,
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
      priority: 42,
      shouldShow: (ctx) => p.isType('tags')(ctx) && p.hasCategory(ctx),
      action: actions.editTag,
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
        (p.inSidebar(ctx) || p.inView('topbar')(ctx)) &&
        p.isType('notes', 'folders', 'tags', 'gameMaps')(ctx),
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
  danger: { label: null, priority: 99 },
}
