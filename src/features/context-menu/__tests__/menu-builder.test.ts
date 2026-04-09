import { describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { ActionHandlers } from '~/features/context-menu/menu-registry'
import type { MenuContext } from '~/features/context-menu/types'
import { VIEW_CONTEXT } from '~/features/context-menu/constants'
import { buildMenu } from '~/features/context-menu/menu-builder'
import { createMenuItems } from '~/features/context-menu/menu-registry'
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
    viewContext: VIEW_CONTEXT.SIDEBAR,
    memberRole: CAMPAIGN_MEMBER_ROLE.DM,
    permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    ...overrides,
  }
}

describe('buildMenu', () => {
  const actions = createActions()
  const items = createMenuItems(actions)

  it('DM sees edit and delete actions on a note in sidebar', () => {
    const ctx = sidebarCtx({ item: createNote() })
    const menu = buildMenu(items, ctx)
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('open')
    expect(ids).toContain('rename')
    expect(ids).toContain('delete')
    expect(ids).toContain('edit-item')
    expect(ids).toContain('toggle-bookmark')
  })

  it('DM sees "New..." submenu on a folder', () => {
    const ctx = sidebarCtx({ item: createFolder() })
    const menu = buildMenu(items, ctx)
    const createNew = menu.flatItems.find((i) => i.id === 'create-new-submenu')
    expect(createNew).toBeDefined()
    expect(createNew!.children).toBeDefined()
    expect(createNew!.children!.length).toBeGreaterThan(0)
  })

  it('player without full access does not see rename/delete', () => {
    const ctx = sidebarCtx({
      item: createNote(),
      memberRole: CAMPAIGN_MEMBER_ROLE.Player,
      permissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const menu = buildMenu(items, ctx)
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).not.toContain('rename')
    expect(ids).not.toContain('delete')
  })

  it('file item shows download-file action', () => {
    const ctx = sidebarCtx({ item: createFile() })
    const menu = buildMenu(items, ctx)
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('download-file')
  })

  it('trashed item shows restore and permanently-delete', () => {
    const ctx: MenuContext = {
      item: createNote(),
      viewContext: VIEW_CONTEXT.TRASH_VIEW,
      isItemTrashed: true,
      isTrashView: true,
      memberRole: CAMPAIGN_MEMBER_ROLE.DM,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    }
    const menu = buildMenu(items, ctx)
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('restore')
    expect(ids).toContain('permanently-delete')
    expect(ids).toContain('empty-trash')
  })

  it('root context (no item) shows "New..." and download-all for DM in sidebar', () => {
    const ctx: MenuContext = {
      item: undefined,
      viewContext: VIEW_CONTEXT.SIDEBAR,
      memberRole: CAMPAIGN_MEMBER_ROLE.DM,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    }
    const menu = buildMenu(items, ctx)
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('create-new-submenu')
    expect(ids).toContain('download-all')
  })

  it('returns isEmpty: true when no items match', () => {
    const menu = buildMenu([], sidebarCtx())
    expect(menu.isEmpty).toBe(true)
    expect(menu.groups).toEqual([])
  })
})
