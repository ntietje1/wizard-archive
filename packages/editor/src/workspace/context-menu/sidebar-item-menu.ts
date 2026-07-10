import { Bookmark, FileType } from 'lucide-react'
import * as p from './predicates'
import * as selection from './selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import { VIEW_CONTEXT } from '../view-context'
import {
  sidebarItemOpenInNewTabMenuItem,
  sidebarItemOpenMenuItem,
  sidebarRevealMenuItem,
} from '../sidebar/menu-items'
import type { ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'
import type { WorkspaceNavigation } from '../runtime'
import { canRenameSidebarItem } from '../../filesystem/capabilities'

export interface WorkspaceSidebarItemContextMenuActions {
  canOpenInNewTab: WorkspaceNavigation['canOpenItemsSeparately']
  open: (context: WorkspaceMenuContext) => void | Promise<void>
  openInNewTab: (context: WorkspaceMenuContext) => void | Promise<void>
  rename: (context: WorkspaceMenuContext) => void
  showInSidebar: (context: WorkspaceMenuContext) => void
  toggleBookmark: (context: WorkspaceMenuContext) => void | Promise<void>
}

export interface WorkspaceSidebarItemContextMenuServices {
  actions: {
    sidebarItem: WorkspaceSidebarItemContextMenuActions
  }
}

type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceSidebarItemContextMenuServices
>

const workspaceItemMenuSurfaces = Object.values(VIEW_CONTEXT)

export const sidebarItemContextMenuCommands = {
  open: createActionCommand<
    WorkspaceMenuContext,
    { sidebarItem: WorkspaceSidebarItemContextMenuActions }
  >('open', (actions, context) => actions.sidebarItem.open(context)),
  openInNewTab: createActionCommand<
    WorkspaceMenuContext,
    { sidebarItem: WorkspaceSidebarItemContextMenuActions }
  >('openInNewTab', (actions, context) => actions.sidebarItem.openInNewTab(context)),
  rename: createActionCommand<
    WorkspaceMenuContext,
    { sidebarItem: WorkspaceSidebarItemContextMenuActions }
  >('rename', (actions, context) => actions.sidebarItem.rename(context)),
  showInSidebar: createActionCommand<
    WorkspaceMenuContext,
    { sidebarItem: WorkspaceSidebarItemContextMenuActions }
  >('showInSidebar', (actions, context) => actions.sidebarItem.showInSidebar(context)),
  toggleBookmark: createActionCommand<
    WorkspaceMenuContext,
    { sidebarItem: WorkspaceSidebarItemContextMenuActions }
  >('toggleBookmark', (actions, context) => actions.sidebarItem.toggleBookmark(context)),
}

export const sidebarItemContextMenuContributors = [
  {
    id: 'workspace-item-primary',
    surfaces: workspaceItemMenuSurfaces,
    getItems: () => [
      {
        ...sidebarItemOpenMenuItem,
        commandId: 'open',
        applies: (context) => selection.isSingleSelection(context) && p.isSidebarItem(context),
      },
      {
        ...sidebarItemOpenInNewTabMenuItem,
        commandId: 'openInNewTab',
        applies: (context, services) =>
          services.actions.sidebarItem.canOpenInNewTab.status === 'available' &&
          selection.isSingleSelection(context) &&
          p.isSidebarItem(context),
      },
      {
        id: 'toggle-bookmark',
        commandId: 'toggleBookmark',
        label: (context) => (context.item?.isBookmarked ? 'Remove Bookmark' : 'Bookmark'),
        icon: Bookmark,
        group: 'primary',
        priority: 2,
        applies: (context) =>
          selection.isSingleSelection(context) &&
          p.inView('sidebar', 'folder-view')(context) &&
          p.isSidebarItem(context),
        isChecked: (context) => context.item?.isBookmarked ?? false,
      },
      {
        ...sidebarRevealMenuItem,
        commandId: 'showInSidebar',
        applies: (context) =>
          selection.isSingleSelection(context) && p.isSidebarItem(context) && !p.inSidebar(context),
      },
    ],
  },
  {
    id: 'sidebar-item-rename',
    surfaces: ['sidebar'],
    getItems: () => [
      {
        id: 'rename',
        commandId: 'rename',
        label: 'Rename',
        icon: FileType,
        group: 'edit',
        priority: 90,
        applies: (context) =>
          selection.isSingleSelection(context) &&
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          Boolean(context.item && canRenameSidebarItem(context.item)),
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>
