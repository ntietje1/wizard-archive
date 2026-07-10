import { WORKSPACE_MODE } from '../../../../../shared/workspace/workspace-mode'
import { BookOpen } from 'lucide-react'
import * as p from './predicates'
import type { WorkspaceMode } from '../../../../../shared/workspace/workspace-mode'
import type { LucideIcon } from 'lucide-react'
import type { ContextMenuCommand, ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'

interface WorkspaceModeMenuService {
  workspaceMode: WorkspaceMode
  canEdit: boolean
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
}

interface WorkspacePanelMenuItem {
  id: string
  label: string
  icon: LucideIcon
}

interface WorkspacePanelMenuService {
  getPanelItems: (context: WorkspaceMenuContext) => Array<WorkspacePanelMenuItem>
  isPanelActive: (context: WorkspaceMenuContext, panelId: string) => boolean
  activatePanel: (context: WorkspaceMenuContext, panelId: string) => void
}

export interface WorkspacePanelContextMenuServices {
  workspaceMode: WorkspaceModeMenuService
  panels: WorkspacePanelMenuService
}

type WorkspacePanelContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspacePanelContextMenuServices
>

function nextWorkspaceMode(currentMode: WorkspaceModeMenuService['workspaceMode']) {
  return currentMode === WORKSPACE_MODE.EDITOR ? WORKSPACE_MODE.VIEWER : WORKSPACE_MODE.EDITOR
}

export const workspacePanelContextMenuCommands = {
  activatePanel: {
    id: 'activatePanel',
    run: (context, services, payload) => {
      if (typeof payload !== 'string') {
        if (import.meta.env.DEV) {
          console.warn('activatePanel command requires a string payload', { context, payload })
        }
        return
      }
      services.panels.activatePanel(context, payload)
    },
  },
  toggleReadingMode: {
    id: 'toggleReadingMode',
    run: (_context, services) => {
      services.workspaceMode.setWorkspaceMode(
        nextWorkspaceMode(services.workspaceMode.workspaceMode),
      )
    },
  },
} satisfies Record<
  string,
  ContextMenuCommand<WorkspaceMenuContext, WorkspacePanelContextMenuServices>
>

export const workspacePanelContextMenuContributors = [
  {
    id: 'workspace-panels',
    surfaces: ['topbar'],
    getItems: (context, services) => [
      {
        id: 'toggle-reading-mode',
        commandId: 'toggleReadingMode',
        label: 'Reading Mode',
        icon: BookOpen,
        group: 'panels',
        priority: 69,
        applies: (itemContext, itemServices) =>
          p.isSidebarItem(itemContext) && itemServices.workspaceMode.canEdit === true,
        isChecked: (_itemContext, itemServices) =>
          itemServices.workspaceMode.workspaceMode === WORKSPACE_MODE.VIEWER,
        closeOnSelect: false,
      },
      ...services.panels.getPanelItems(context).map((panel, index) => ({
        id: `panel-${panel.id}`,
        commandId: 'activatePanel',
        payload: panel.id,
        label: panel.label,
        icon: panel.icon,
        group: 'panels',
        priority: 70 + index,
        applies: p.isSidebarItem,
        isChecked: (
          itemContext: WorkspaceMenuContext,
          itemServices: WorkspacePanelContextMenuServices,
        ) => itemServices.panels.isPanelActive(itemContext, panel.id),
      })),
    ],
  },
] satisfies ReadonlyArray<WorkspacePanelContextMenuContributor>
