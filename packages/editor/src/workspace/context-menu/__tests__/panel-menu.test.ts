import { describe, expect, it, vi } from 'vite-plus/test'
import { ArrowUpLeft, ArrowUpRight, History, List } from 'lucide-react'
import { WORKSPACE_MODE } from '../../../../../../shared/workspace/workspace-mode'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { RESOURCE_TYPES } from '../../items-persistence-contract'
import { VIEW_CONTEXT } from '../../view-context'
import { buildMenu } from '../../../context-menu/menu-builder'
import { workspaceContextMenuGroupConfig } from '../group-config'
import type { WorkspaceMenuContext } from '../../menu-context'
import { createFile, createNote } from '../../../test/sidebar-item-factory'
import {
  workspacePanelContextMenuCommands,
  workspacePanelContextMenuContributors,
} from '../panel-menu'
import type { WorkspacePanelContextMenuServices } from '../panel-menu'
import { createRightSidebarPanelMenuService } from '../../right-sidebar/panel-menu-service'
import { createPanelPreferenceStore } from '@wizard-archive/ui/panel-preferences/store'
import { RIGHT_SIDEBAR_CONTENT } from '../../right-sidebar/content'

describe('workspace panel context menu', () => {
  it('shows reading mode in the topbar context menu for editable items', () => {
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createPanelServices(),
      contributors: workspacePanelContextMenuContributors,
      commands: workspacePanelContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.find((menuItem) => menuItem.id === 'toggle-reading-mode')).toMatchObject({
      label: 'Reading Mode',
      closeOnSelect: false,
    })
  })

  it('builds workspace panel menus with only panel services', () => {
    const note = createNote()
    const setWorkspaceMode = vi.fn()
    const activatePanel = vi.fn()
    const services = createPanelServices({
      workspaceMode: {
        workspaceMode: WORKSPACE_MODE.EDITOR,
        canEdit: true,
        setWorkspaceMode,
      },
      panels: {
        getPanelItems: () => [{ id: 'outline', label: 'Outline', icon: List }],
        isPanelActive: (_context, panelId) => panelId === 'outline',
        activatePanel,
      },
    })
    const topbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services,
      contributors: workspacePanelContextMenuContributors,
      commands: workspacePanelContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(topbarMenu.flatItems.find((item) => item.id === 'panel-outline')).toMatchObject({
      label: 'Outline',
      checked: true,
    })

    workspacePanelContextMenuCommands.toggleReadingMode.run(
      {
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        selectedItems: [note],
      },
      services,
    )
    workspacePanelContextMenuCommands.activatePanel.run(
      {
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        selectedItems: [note],
      },
      services,
      'outline',
    )

    expect(setWorkspaceMode).toHaveBeenCalledExactlyOnceWith(WORKSPACE_MODE.VIEWER)
    expect(activatePanel).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ item: note }),
      'outline',
    )
  })

  it('shows right-sidebar panel items supplied by the workspace runtime service', () => {
    const note = createNote()
    const file = createFile()
    const services = createPanelServices()
    const noteMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services,
      contributors: workspacePanelContextMenuContributors,
      commands: workspacePanelContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const fileMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: file,
        primaryItem: file,
        selectedItems: [file],
      }),
      services,
      contributors: workspacePanelContextMenuContributors,
      commands: workspacePanelContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(noteMenu.flatItems.map((menuItem) => menuItem.id)).toEqual(
      expect.arrayContaining([
        'panel-history',
        'panel-backlinks',
        'panel-outgoing',
        'panel-outline',
      ]),
    )
    expect(fileMenu.flatItems.find((menuItem) => menuItem.id === 'panel-history')).toMatchObject({
      label: 'Edit History',
    })
  })

  it('does not advertise panels outside the right-sidebar capability projection', () => {
    const note = createNote()
    const context = sidebarCtx({
      surface: VIEW_CONTEXT.TOPBAR,
      item: note,
      primaryItem: note,
      selectedItems: [note],
    })
    const panels = createRightSidebarPanelMenuService(createPanelPreferenceStore(), {
      [RIGHT_SIDEBAR_CONTENT.outline]: true,
    })

    expect(panels.getPanelItems(context).map((panel) => panel.id)).toEqual([
      RIGHT_SIDEBAR_CONTENT.outline,
    ])
    expect(panels.isPanelActive(context, RIGHT_SIDEBAR_CONTENT.history)).toBe(false)
  })

  it('checks reading mode in viewer mode and toggles without closing the menu', async () => {
    const setWorkspaceMode = vi.fn()
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createPanelServices({
        workspaceMode: { workspaceMode: WORKSPACE_MODE.VIEWER, setWorkspaceMode, canEdit: true },
      }),
      contributors: workspacePanelContextMenuContributors,
      commands: workspacePanelContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const readingModeItem = menu.flatItems.find((menuItem) => menuItem.id === 'toggle-reading-mode')

    expect(readingModeItem).toMatchObject({
      label: 'Reading Mode',
      checked: true,
      closeOnSelect: false,
    })

    await readingModeItem?.onSelect()

    expect(setWorkspaceMode).toHaveBeenCalledExactlyOnceWith(WORKSPACE_MODE.EDITOR)
  })
})

function sidebarCtx(overrides: Partial<WorkspaceMenuContext> = {}): WorkspaceMenuContext {
  const item = Object.hasOwn(overrides, 'item') ? overrides.item : createNote()
  return {
    item,
    primaryItem: item,
    selectedItems: item ? [item] : [],
    surface: VIEW_CONTEXT.SIDEBAR,
    permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    ...overrides,
  }
}

function createPanelServices(
  overrides: Partial<WorkspacePanelContextMenuServices> = {},
): WorkspacePanelContextMenuServices {
  return {
    workspaceMode: {
      workspaceMode: WORKSPACE_MODE.EDITOR,
      canEdit: true,
      setWorkspaceMode: vi.fn(),
      ...overrides.workspaceMode,
    },
    panels: {
      getPanelItems: getPanelItems,
      isPanelActive: vi.fn(() => false),
      activatePanel: vi.fn(),
      ...overrides.panels,
    },
  }
}

function getPanelItems(context: WorkspaceMenuContext) {
  const history = { id: 'history', label: 'Edit History', icon: History }
  if (context.item?.type === RESOURCE_TYPES.files) return [history]
  return [
    history,
    { id: 'backlinks', label: 'Back Links', icon: ArrowUpLeft },
    { id: 'outgoing', label: 'Outgoing Links', icon: ArrowUpRight },
    { id: 'outline', label: 'Outline', icon: List },
  ]
}
