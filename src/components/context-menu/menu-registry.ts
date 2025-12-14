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
} from 'lucide-react'

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

  goToCategory: (ctx: MenuContext) => void
  editCategory: (ctx: MenuContext) => void

  editMap: (ctx: MenuContext) => void

  editTag: (ctx: MenuContext) => void
}

export function createMenuItems(actions: ActionHandlers): MenuItemDef[] {
  return [
    // ========== PRIMARY GROUP ==========
    {
      id: 'open',
      label: 'Open',
      icon: FilePlus,
      group: 'primary',
      priority: 0,
      shouldShow: p.and(
        p.isType('notes', 'gameMaps', 'folders', 'tags'),
        p.inSidebar,
      ),
      action: actions.open,
    },

    // ========== CREATE GROUP ==========
    {
      id: 'create-new-submenu',
      label: 'New...',
      icon: Plus,
      group: 'create',
      priority: 5,
      shouldShow: p.and(
        p.canEdit,
        p.or(p.isType('folders'), p.isType('tagCategories'), p.atRoot),
      ),
      action: () => {}, // No action for submenu parent
      children: [
        // "New Tag"
        {
          id: 'submenu-create-tag',
          label: (ctx) => ctx.category?.name || 'Tag',
          icon: Tags,
          group: 'create',
          priority: 1,
          shouldShow: p.and(
            p.canEdit,
            p.or(
              p.and(p.isType('tagCategories'), p.hasCategory),
              p.and(p.isType('folders'), p.hasCategory),
            ),
          ),
          action: actions.createTag,
        },
        // "New Category"
        {
          id: 'submenu-create-category',
          label: 'Category',
          icon: Tags,
          group: 'create',
          priority: 2,
          shouldShow: p.and(
            p.canEdit,
            p.atRoot,
            p.not(
              p.isType('notes', 'folders', 'tags', 'tagCategories', 'gameMaps'),
            ),
          ),
          action: actions.createCategory,
        },
        // Note, Folder, Map, Canvas
        {
          id: 'submenu-create-note',
          label: 'Note',
          icon: FilePlus,
          group: 'create',
          priority: 10,
          shouldShow: p.and(
            p.canEdit,
            p.not(p.isType('notes', 'tags', 'gameMaps')),
            p.or(p.isType('folders'), p.isType('tagCategories'), p.atRoot),
          ),
          action: actions.createNote,
        },
        {
          id: 'submenu-create-folder',
          label: 'Folder',
          icon: FolderPlus,
          group: 'create',
          priority: 11,
          shouldShow: p.and(
            p.canEdit,
            p.not(p.isType('notes', 'tags', 'gameMaps')),
            p.or(p.isType('folders'), p.isType('tagCategories'), p.atRoot),
          ),
          action: actions.createFolder,
        },
        {
          id: 'submenu-create-map',
          label: 'Map',
          icon: MapPin,
          group: 'create',
          priority: 12,
          shouldShow: p.and(
            p.canEdit,
            p.not(p.isType('notes', 'tags', 'gameMaps')),
            p.or(p.isType('folders'), p.isType('tagCategories'), p.atRoot),
          ),
          action: actions.createMap,
        },
        {
          id: 'submenu-create-canvas',
          label: 'Canvas',
          icon: Grid2x2Plus,
          group: 'create',
          priority: 13,
          shouldShow: p.and(
            p.canEdit,
            p.not(p.isType('notes', 'tags', 'gameMaps')),
            p.or(p.isType('folders'), p.isType('tagCategories'), p.atRoot),
          ),
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
      shouldShow: p.and(
        p.canEdit,
        p.inSidebar,
        p.isType('notes', 'folders', 'tags', 'gameMaps'),
      ),
      action: actions.rename,
    },

    // ========== NAVIGATION GROUP ==========
    {
      id: 'show-in-sidebar',
      label: 'Show in Sidebar',
      icon: Eye,
      group: 'primary',
      priority: 0,
      shouldShow: p.and(
        p.isType('notes', 'gameMaps', 'folders', 'tags'),
        p.notInSidebar,
      ),
      action: actions.showInSidebar,
    },
    {
      id: 'go-to-category',
      label: (ctx) =>
        `Go to ${ctx.category?.pluralName || ctx.category?.name || 'Category'}`,
      icon: SquareArrowOutUpRight,
      group: 'primary',
      priority: 0,
      shouldShow: p.and(p.isType('tagCategories'), p.hasCategory),
      action: actions.goToCategory,
    },

    // ========== TYPE-SPECIFIC GROUP ==========
    {
      id: 'edit-map',
      label: 'Edit Map',
      icon: FileEdit,
      group: 'type-specific',
      priority: 40,
      shouldShow: p.and(p.isType('gameMaps'), p.canEdit),
      action: actions.editMap,
    },
    {
      id: 'edit-category',
      label: 'Edit Category',
      icon: FileEdit,
      group: 'type-specific',
      priority: 41,
      shouldShow: p.and(p.isType('tagCategories'), p.hasCategory, p.canEdit),
      action: actions.editCategory,
    },
    {
      id: 'edit-tag',
      label: (ctx) =>
        ctx.category?.name ? `Edit ${ctx.category.name}` : 'Edit Tag',
      icon: FileEdit,
      group: 'type-specific',
      priority: 42,
      shouldShow: p.and(p.isType('tags'), p.hasCategory, p.canEdit),
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
      shouldShow: p.and(
        p.canDelete,
        p.inSidebar,
        p.isType('notes', 'folders', 'tags', 'gameMaps'),
      ),
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
