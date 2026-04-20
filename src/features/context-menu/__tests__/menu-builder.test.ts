import { describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { ActionHandlers } from '~/features/context-menu/menu-registry'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  MenuContext,
} from '~/features/context-menu/types'
import { VIEW_CONTEXT } from '~/features/context-menu/constants'
import { buildMenu } from '~/features/context-menu/menu-builder'
import {
  editorContextMenuCommands,
  editorContextMenuContributors,
  groupConfig,
} from '~/features/context-menu/menu-registry'
import { createFile, createFolder, createNote } from '~/test/factories/sidebar-item-factory'

function createActions(): ActionHandlers {
  return {
    open: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    showInSidebar: vi.fn(),
    createNote: vi.fn(),
    createFolder: vi.fn(),
    createMap: vi.fn(),
    createFile: vi.fn(),
    createCanvas: vi.fn(),
    editMap: vi.fn(),
    editFile: vi.fn(),
    editItem: vi.fn(),
    pinToMap: vi.fn(),
    goToMapPin: vi.fn(),
    createMapPin: vi.fn(),
    removeMapPin: vi.fn(),
    moveMapPin: vi.fn(),
    togglePinVisibility: vi.fn(),
    startSession: vi.fn(),
    endSession: vi.fn(),
    setGeneralAccessLevel: vi.fn(),
    downloadFile: vi.fn(),
    downloadNote: vi.fn(),
    downloadMap: vi.fn(),
    downloadFolder: vi.fn(),
    downloadAll: vi.fn(),
    toggleBookmark: vi.fn(),
    restore: vi.fn(),
    permanentlyDelete: vi.fn(),
    emptyTrash: vi.fn(),
  }
}

function sidebarCtx(overrides: Partial<MenuContext> = {}): MenuContext {
  return {
    item: createNote(),
    surface: VIEW_CONTEXT.SIDEBAR,
    memberRole: CAMPAIGN_MEMBER_ROLE.DM,
    permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    ...overrides,
  }
}

describe('buildMenu', () => {
  const actions = createActions()
  const services = { actions }

  it('DM sees edit and delete actions on a note in sidebar', () => {
    const menu = buildMenu({
      context: sidebarCtx({ item: createNote() }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('open')
    expect(ids).toContain('rename')
    expect(ids).toContain('delete')
    expect(ids).toContain('edit-item')
    expect(ids).toContain('toggle-bookmark')
  })

  it('DM sees "New..." submenu on a folder', () => {
    const menu = buildMenu({
      context: sidebarCtx({ item: createFolder() }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const createNew = menu.flatItems.find((i) => i.id === 'create-new-submenu')
    expect(createNew).toBeDefined()
    expect(createNew!.children).toBeDefined()
    expect(createNew!.children!.length).toBeGreaterThan(0)
  })

  it('player without full access does not see rename/delete', () => {
    const menu = buildMenu({
      context: sidebarCtx({
        item: createNote(),
        memberRole: CAMPAIGN_MEMBER_ROLE.Player,
        permissionLevel: PERMISSION_LEVEL.VIEW,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).not.toContain('rename')
    expect(ids).not.toContain('delete')
  })

  it('file item shows download-file action', () => {
    const menu = buildMenu({
      context: sidebarCtx({ item: createFile() }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('download-file')
  })

  it('trashed item shows restore and permanently-delete', () => {
    const ctx: MenuContext = {
      item: createNote(),
      surface: VIEW_CONTEXT.TRASH_VIEW,
      isItemTrashed: true,
      isTrashView: true,
      memberRole: CAMPAIGN_MEMBER_ROLE.DM,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    }
    const menu = buildMenu({
      context: ctx,
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('restore')
    expect(ids).toContain('permanently-delete')
    expect(ids).toContain('empty-trash')
  })

  it('root context (no item) shows "New..." and download-all for DM in sidebar', () => {
    const ctx: MenuContext = {
      item: undefined,
      surface: VIEW_CONTEXT.SIDEBAR,
      memberRole: CAMPAIGN_MEMBER_ROLE.DM,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    }
    const menu = buildMenu({
      context: ctx,
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('create-new-submenu')
    expect(ids).toContain('download-all')
  })

  it('returns isEmpty: true when no items match', () => {
    const menu = buildMenu({
      context: sidebarCtx(),
      services,
      contributors: [],
      commands: editorContextMenuCommands,
      groupConfig,
    })
    expect(menu.isEmpty).toBe(true)
    expect(menu.groups).toEqual([])
  })

  it('suppresses duplicate selection-scoped commands when a target-scoped item exists', () => {
    const commands = {
      duplicate: {
        id: 'duplicate',
        label: 'Duplicate',
        run: vi.fn(),
      },
    } satisfies Record<string, ContextMenuCommand<MenuContext, Record<string, never>, any>>
    const contributors = [
      {
        id: 'selection',
        surfaces: [VIEW_CONTEXT.SIDEBAR],
        getItems: () => [
          {
            id: 'selection-duplicate',
            commandId: 'duplicate',
            label: 'Duplicate selection',
            group: 'edit',
            priority: 0,
            scope: 'selection',
          },
        ],
      },
      {
        id: 'target',
        surfaces: [VIEW_CONTEXT.SIDEBAR],
        getItems: () => [
          {
            id: 'target-duplicate',
            commandId: 'duplicate',
            label: 'Duplicate target',
            group: 'edit',
            priority: 1,
            scope: 'target',
          },
        ],
      },
    ] satisfies ReadonlyArray<ContextMenuContributor<MenuContext, Record<string, never>>>

    const menu = buildMenu({
      context: sidebarCtx(),
      services: {},
      contributors,
      commands,
      groupConfig,
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual(['target-duplicate'])
  })
})
