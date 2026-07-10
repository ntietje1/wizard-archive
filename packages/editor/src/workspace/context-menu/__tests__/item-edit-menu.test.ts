import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { buildMenu } from '../../../context-menu/menu-builder'
import { workspaceContextMenuGroupConfig } from '../group-config'
import { VIEW_CONTEXT } from '../../view-context'
import type { WorkspaceMenuContext } from '../../menu-context'
import {
  workspaceItemEditContextMenuCommands,
  workspaceItemEditContextMenuContributors,
} from '../item-edit-menu'
import type { WorkspaceItemEditContextMenuServices } from '../item-edit-menu'
import { createFile, createGameMap, createNote } from '../../../test/sidebar-item-factory'

describe('workspace item edit context menu', () => {
  it('routes note edit through the runtime item edit action fragment', async () => {
    const editItem = vi.fn()
    const note = createNote()
    const services = createServices({ editItem })
    const menu = buildMenu({
      context: ctx({ item: note }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const edit = menu.flatItems.find((item) => item.id === 'edit-item')

    expect(edit).toMatchObject({ label: 'Edit Note' })
    await edit?.onSelect()
    expect(editItem).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: note }))
  })

  it('routes map and file edit through type-owned runtime actions', async () => {
    const editMap = vi.fn()
    const editFile = vi.fn()
    const services = createServices({ editMap, editFile })
    const map = createGameMap()
    const file = createFile()

    const mapMenu = buildMenu({
      context: ctx({ item: map }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const fileMenu = buildMenu({
      context: ctx({ item: file }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    await mapMenu.flatItems.find((item) => item.id === 'edit-map')?.onSelect()
    await fileMenu.flatItems.find((item) => item.id === 'edit-file')?.onSelect()

    expect(editMap).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: map }))
    expect(editFile).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ item: file }))
  })

  it('allows item edit actions with edit access', () => {
    const services = createServices()
    const file = createFile({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    const map = createGameMap({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })

    const fileMenu = buildMenu({
      context: ctx({ item: file, permissionLevel: PERMISSION_LEVEL.EDIT }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const mapMenu = buildMenu({
      context: ctx({ item: map, permissionLevel: PERMISSION_LEVEL.EDIT }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const noteMenu = buildMenu({
      context: ctx({ item: note, permissionLevel: PERMISSION_LEVEL.EDIT }),
      services,
      contributors: workspaceItemEditContextMenuContributors,
      commands: workspaceItemEditContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(fileMenu.flatItems.map((item) => item.id)).toContain('edit-file')
    expect(mapMenu.flatItems.map((item) => item.id)).toContain('edit-map')
    expect(noteMenu.flatItems.map((item) => item.id)).toContain('edit-item')
  })
})

function ctx(overrides: Partial<WorkspaceMenuContext> = {}): WorkspaceMenuContext {
  const item = overrides.item ?? createNote()
  return {
    surface: VIEW_CONTEXT.SIDEBAR,
    item,
    primaryItem: item,
    selectedItems: [item],
    permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    ...overrides,
  }
}

function createServices(
  actions: Partial<WorkspaceItemEditContextMenuServices['actions']['itemEdit']> = {},
): WorkspaceItemEditContextMenuServices {
  return {
    actions: {
      itemEdit: {
        editMap: vi.fn(),
        editFile: vi.fn(),
        editItem: vi.fn(),
        ...actions,
      },
    },
  }
}
