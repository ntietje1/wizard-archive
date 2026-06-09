import { EDITOR_MODE } from 'shared/editor/types'
import { BookOpen } from 'lucide-react'
import * as p from '../predicates'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  EditorContextMenuServices,
  EditorMenuContext,
  EditorModeMenuService,
} from '../types'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

function nextEditorMode(currentMode: EditorModeMenuService['editorMode']) {
  return currentMode === EDITOR_MODE.EDITOR ? EDITOR_MODE.VIEWER : EDITOR_MODE.EDITOR
}

export const editorPanelContextMenuCommands = {
  activatePanel: {
    id: 'activatePanel',
    run: (context, services, payload) => {
      if (typeof payload !== 'string') {
        if (import.meta.env.DEV) {
          console.warn('activatePanel command requires a string payload', { context, payload })
        }
        return
      }
      services.editorPanels.activatePanel(context, payload)
    },
  },
  toggleReadingMode: {
    id: 'toggleReadingMode',
    run: (_context, services) => {
      services.editorMode.setEditorMode(nextEditorMode(services.editorMode.editorMode))
    },
  },
} satisfies Record<string, ContextMenuCommand<EditorMenuContext, EditorContextMenuServices>>

export const editorPanelContextMenuContributors = [
  {
    id: 'editor-panels',
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
          p.isSidebarItem(itemContext) && itemServices.editorMode.canEdit === true,
        isChecked: (_itemContext, itemServices) =>
          itemServices.editorMode.editorMode === EDITOR_MODE.VIEWER,
        closeOnSelect: false,
      },
      ...services.editorPanels.getPanelItems(context).map((panel, index) => ({
        id: `panel-${panel.id}`,
        commandId: 'activatePanel',
        payload: panel.id,
        label: panel.label,
        icon: panel.icon,
        group: 'panels',
        priority: 70 + index,
        applies: p.isSidebarItem,
        isChecked: (itemContext: EditorMenuContext, itemServices: EditorContextMenuServices) =>
          itemServices.editorPanels.isPanelActive(itemContext, panel.id),
      })),
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
