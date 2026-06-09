import { describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { EDITOR_MODE } from 'shared/editor/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  EditorContextMenuActionHandlers,
  EditorModeMenuService,
  ViewAsPlayerMenuService,
  MenuContext,
} from '~/features/context-menu/types'
import { VIEW_CONTEXT } from '~/features/context-menu/constants'
import { buildMenu } from '~/features/context-menu/menu-builder'
import {
  editorContextMenuCommands,
  editorContextMenuContributors,
  groupConfig,
} from '~/features/context-menu/menu-registry'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '~/test/factories/sidebar-item-factory'

const toastInfo = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    info: toastInfo,
  },
}))

function createActions(): EditorContextMenuActionHandlers {
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
    downloadItems: vi.fn(),
    downloadAll: vi.fn(),
    toggleBookmark: vi.fn(),
    paste: vi.fn(),
    duplicate: vi.fn(),
    restore: vi.fn(),
    permanentlyDelete: vi.fn(),
    emptyTrash: vi.fn(),
  }
}

function createServices({
  editorMode: editorModeOverrides,
  viewAsPlayer: viewAsPlayerOverrides,
  blockShare: blockShareOverrides,
}: {
  editorMode?: Partial<typeof baseEditorModeService>
  viewAsPlayer?: Partial<typeof baseViewAsPlayerService>
  blockShare?: Partial<typeof baseBlockShareService>
} = {}) {
  return {
    actions: createActions(),
    filesystem: { canPasteIntoTarget: () => false },
    editorMode: { ...baseEditorModeService, ...editorModeOverrides },
    viewAsPlayer: { ...baseViewAsPlayerService, ...viewAsPlayerOverrides },
    blockShare: { ...baseBlockShareService, ...blockShareOverrides },
  }
}

const baseEditorModeService: EditorModeMenuService = {
  editorMode: EDITOR_MODE.EDITOR,
  canEdit: true,
  setEditorMode: vi.fn(),
}

const baseViewAsPlayerService: ViewAsPlayerMenuService = {
  viewAsPlayerId: undefined,
  setViewAsPlayerId: vi.fn(),
  playerMembers: [
    {
      _id: 'player-1' as never,
      role: CAMPAIGN_MEMBER_ROLE.Player,
      userProfile: { name: 'Mina', username: 'mina', imageUrl: 'https://example.com/mina.png' },
    } as unknown as ViewAsPlayerMenuService['playerMembers'][number],
  ],
}

interface TestBlockShareService {
  canOpen: (context: MenuContext) => boolean
  canToggleAllPlayersPermission: (context: MenuContext) => boolean
  getBlockCount: (context: MenuContext) => number
  getAllPlayersPermissionLevel: (context: MenuContext) => 'hidden' | 'visible' | 'mixed'
  toggleAllPlayersPermission: (context: MenuContext) => void
}

const baseBlockShareService: TestBlockShareService = {
  canOpen: vi.fn(() => false),
  canToggleAllPlayersPermission: vi.fn(() => true),
  getBlockCount: vi.fn(() => 0),
  getAllPlayersPermissionLevel: vi.fn((): 'hidden' => 'hidden'),
  toggleAllPlayersPermission: vi.fn(),
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
  const services = createServices()

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

  it('multi-selection keeps batch actions and hides single-item edit actions', () => {
    const selectedItems = [createNote(), createFile()]
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('delete')
    expect(ids).toContain('download-items')
    expect(ids).toContain('toggle-bookmark')
    expect(ids).toContain('duplicate')
    expect(ids).not.toContain('copy')
    expect(ids).not.toContain('cut')
    expect(ids).not.toContain('rename')
    expect(ids).not.toContain('edit-item')
    expect(ids).not.toContain('show-in-sidebar')
  })

  it('folder view keeps batch actions without exposing copy or cut', () => {
    const selectedItems = [createNote(), createFile()]
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.FOLDER_VIEW,
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('duplicate')
    expect(ids).toContain('delete')
    expect(ids).toContain('toggle-bookmark')
    expect(ids).not.toContain('copy')
    expect(ids).not.toContain('cut')
    expect(ids).not.toContain('rename')
  })

  it('shows Paste only when the filesystem clipboard can paste', () => {
    const folder = createFolder()
    const menuWithoutClipboard = buildMenu({
      context: sidebarCtx({ item: folder }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const menuWithClipboard = buildMenu({
      context: sidebarCtx({ item: folder }),
      services: { ...services, filesystem: { canPasteIntoTarget: () => true } },
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(menuWithoutClipboard.flatItems.map((item) => item.id)).not.toContain('paste')
    expect(menuWithClipboard.flatItems.map((item) => item.id)).toContain('paste')
  })

  it('hides active-item operations when any selected root is trashed', () => {
    const deletionTime = 1_700_000_000_000
    const selectedItems = [createNote(), createFile({ status: 'trashed', deletionTime })]
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).not.toContain('copy')
    expect(ids).not.toContain('cut')
    expect(ids).not.toContain('duplicate')
    expect(ids).not.toContain('delete')
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
    expect(createNew).toMatchObject({ label: 'New...' })
    expect(
      createNew!.children?.map((item) => ({
        id: item.id,
        commandId: item.commandId,
        label: item.label,
      })),
    ).toEqual([
      { id: 'submenu-create-note', commandId: 'createNote', label: 'Note' },
      { id: 'submenu-create-folder', commandId: 'createFolder', label: 'Folder' },
      { id: 'submenu-create-map', commandId: 'createMap', label: 'Map' },
      { id: 'submenu-create-canvas', commandId: 'createCanvas', label: 'Canvas' },
      { id: 'submenu-create-file', commandId: 'createFile', label: 'File' },
    ])
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

  it('file item shows the unified download action', () => {
    const menu = buildMenu({
      context: sidebarCtx({ item: createFile() }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('download-items')
    expect(ids).not.toContain('download-file')
  })

  it('mixed multi-selection shows one unified download action', () => {
    const selectedItems = [createNote(), createFile(), createGameMap()]
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids.filter((id) => id.startsWith('download'))).toEqual(['download-items'])
  })

  it('renders share as submenu content instead of an action command', () => {
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({ item: note }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const shareItem = menu.flatItems.find((i) => i.id === 'share-items')
    expect(shareItem?.commandId).toBeUndefined()
    expect(shareItem?.submenuContent).toBeDefined()
  })

  it('multi-selection can pin multiple selected items to a map', () => {
    const selectedItems = [createNote(), createFile()]
    const activeMap = createGameMap()
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
        activeMap: {
          ...activeMap,
          ancestors: [],
          pins: [],
        },
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('pin-to-map')
  })

  it('trashed item shows restore and permanently-delete', () => {
    const ctx: MenuContext = {
      item: createNote({ status: 'trashed', deletionTime: Date.now() }),
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

  it('does not expose folder trash or restore actions to players', () => {
    const activeFolder = createFolder()
    const trashFolder = createFolder({ status: 'trashed', deletionTime: Date.now() })
    const activeMenu = buildMenu({
      context: sidebarCtx({
        item: activeFolder,
        memberRole: CAMPAIGN_MEMBER_ROLE.Player,
        permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const trashMenu = buildMenu({
      context: sidebarCtx({
        item: trashFolder,
        surface: VIEW_CONTEXT.TRASH_VIEW,
        isItemTrashed: true,
        isTrashView: true,
        memberRole: CAMPAIGN_MEMBER_ROLE.Player,
        permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      }),
      services,
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(activeMenu.flatItems.map((item) => item.id)).not.toContain('delete')
    expect(trashMenu.flatItems.map((item) => item.id)).not.toContain('restore')
    expect(trashMenu.flatItems.map((item) => item.id)).not.toContain('permanently-delete')
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

  it('shows reading mode only in the topbar context menu for editable items', () => {
    const note = createNote()
    const topbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const sidebarMenu = buildMenu({
      context: sidebarCtx({ item: note }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const readOnlyTopbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices({ editorMode: { canEdit: false } }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(topbarMenu.flatItems.map((menuItem) => menuItem.id)).toContain('toggle-reading-mode')
    expect(sidebarMenu.flatItems.map((menuItem) => menuItem.id)).not.toContain(
      'toggle-reading-mode',
    )
    expect(readOnlyTopbarMenu.flatItems.map((menuItem) => menuItem.id)).not.toContain(
      'toggle-reading-mode',
    )
  })

  it('only shows right-sidebar panels supported by the current item type', () => {
    const note = createNote()
    const file = createFile()
    const noteMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const fileMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: file,
        primaryItem: file,
        selectedItems: [file],
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(noteMenu.flatItems.map((menuItem) => menuItem.id)).toEqual(
      expect.arrayContaining([
        'panel-history',
        'panel-backlinks',
        'panel-outgoing',
        'panel-outline',
      ]),
    )
    expect(fileMenu.flatItems.map((menuItem) => menuItem.id)).toContain('panel-history')
    expect(fileMenu.flatItems.map((menuItem) => menuItem.id)).not.toEqual(
      expect.arrayContaining(['panel-backlinks', 'panel-outgoing', 'panel-outline']),
    )
  })

  it('shows value editing only for editable value inline content', () => {
    const valueMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: undefined,
        selectedItems: [],
        valueInlineId: 'value-1',
        valueInlineEditable: true,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const readonlyValueMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: undefined,
        selectedItems: [],
        valueInlineId: 'value-1',
        valueInlineEditable: false,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const generalNoteMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: undefined,
        selectedItems: [],
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(valueMenu.flatItems.map((item) => item.id)).toContain('edit-value-inline')
    expect(readonlyValueMenu.flatItems.map((item) => item.id)).not.toContain('edit-value-inline')
    expect(generalNoteMenu.flatItems.map((item) => item.id)).not.toContain('edit-value-inline')
  })

  it('shares hidden blocks with all players from the note editor context menu', async () => {
    const toggleAllPlayersPermission = vi.fn()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        blockNoteId: 'block-1' as never,
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          getBlockCount: () => 2,
          getAllPlayersPermissionLevel: () => 'hidden',
          toggleAllPlayersPermission,
        },
      }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(menu.flatItems.map((item) => item.id)).not.toContain('test-block')
    expect(shareBlocksItem).toMatchObject({
      label: 'Share 2 Blocks',
      group: 'share',
      closeOnSelect: false,
    })

    await shareBlocksItem?.onSelect()

    expect(toggleAllPlayersPermission).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ blockNoteId: 'block-1' }),
    )
  })

  it('unshares all-player-visible blocks from the note editor context menu', async () => {
    const toggleAllPlayersPermission = vi.fn()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        blockNoteId: 'block-1' as never,
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          getBlockCount: () => 1,
          getAllPlayersPermissionLevel: () => 'visible',
          toggleAllPlayersPermission,
        },
      }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Unshare Block',
      group: 'share',
      closeOnSelect: false,
    })

    await shareBlocksItem?.onSelect()

    expect(toggleAllPlayersPermission).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ blockNoteId: 'block-1' }),
    )
  })

  it('keeps the optimistic block share item visible but disabled while a toggle is pending', () => {
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        blockNoteId: 'block-1' as never,
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          canToggleAllPlayersPermission: () => false,
          getBlockCount: () => 1,
          getAllPlayersPermissionLevel: () => 'visible',
        },
      }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Unshare Block',
      disabled: true,
      closeOnSelect: false,
    })
  })

  it('shows paste on editor text content and removes the temporary test editor item', async () => {
    const editorRoot = document.createElement('div')
    document.body.append(editorRoot)
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        editor: { domElement: editorRoot } as never,
        isEditorTextContext: true,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const pasteItem = menu.flatItems.find((item) => item.id === 'editor-paste')

    expect(menu.flatItems.map((item) => item.id)).not.toContain('test-editor')
    expect(pasteItem).toMatchObject({
      label: 'Paste',
      shortcut: 'Ctrl+V',
    })
    expect(menu.flatItems.map((item) => item.id)).not.toContain('editor-cut')
    expect(menu.flatItems.map((item) => item.id)).not.toContain('editor-copy')

    await pasteItem?.onSelect()

    expect(toastInfo).toHaveBeenCalledExactlyOnceWith('Coming soon')
    editorRoot.remove()
  })

  it('shows cut and copy only when the current selection is inside the editor', () => {
    const editorRoot = document.createElement('div')
    const selectedText = document.createElement('span')
    selectedText.textContent = 'selected text'
    editorRoot.append(selectedText)
    document.body.append(editorRoot)

    const range = document.createRange()
    range.selectNodeContents(selectedText)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    const selectedMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        editor: { domElement: editorRoot } as never,
        isEditorTextContext: true,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const outsideRoot = document.createElement('div')
    const outsideMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        editor: { domElement: outsideRoot } as never,
        isEditorTextContext: true,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    expect(selectedMenu.flatItems.find((item) => item.id === 'editor-cut')).toMatchObject({
      label: 'Cut',
      shortcut: 'Ctrl+X',
    })
    expect(selectedMenu.flatItems.find((item) => item.id === 'editor-copy')).toMatchObject({
      label: 'Copy',
      shortcut: 'Ctrl+C',
    })
    expect(outsideMenu.flatItems.map((item) => item.id)).not.toContain('editor-cut')
    expect(outsideMenu.flatItems.map((item) => item.id)).not.toContain('editor-copy')

    selection?.removeAllRanges()
    editorRoot.remove()
  })

  it('checks reading mode in viewer mode and toggles without closing the menu', async () => {
    const setEditorMode = vi.fn()
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices({ editorMode: { editorMode: EDITOR_MODE.VIEWER, setEditorMode } }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const readingModeItem = menu.flatItems.find((menuItem) => menuItem.id === 'toggle-reading-mode')

    expect(readingModeItem).toMatchObject({
      label: 'Reading Mode',
      checked: true,
      closeOnSelect: false,
    })

    await readingModeItem?.onSelect()

    expect(setEditorMode).toHaveBeenCalledExactlyOnceWith(EDITOR_MODE.EDITOR)
  })

  it('shows view as player with rich player submenu rows in the topbar context menu for DMs with players', () => {
    const note = createNote()
    const topbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const sidebarMenu = buildMenu({
      context: sidebarCtx({ item: note }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const playerTopbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
        memberRole: CAMPAIGN_MEMBER_ROLE.Player,
      }),
      services: createServices(),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })
    const noPlayersTopbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices({ viewAsPlayer: { playerMembers: [] } }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const viewAsItem = topbarMenu.flatItems.find((menuItem) => menuItem.id === 'view-as-player')
    const playerItem = viewAsItem?.children?.find((menuItem) => menuItem.id === 'view-as-player-0')
    const topbarItemIds = topbarMenu.flatItems.map((menuItem) => menuItem.id)

    expect(viewAsItem).toMatchObject({
      label: 'View as Player...',
      group: 'share',
      checked: false,
    })
    expect(topbarItemIds.indexOf('share-items')).toBeLessThan(
      topbarItemIds.indexOf('view-as-player'),
    )
    expect(playerItem).toMatchObject({
      label: 'Mina',
      checked: false,
      closeOnSelect: false,
    })
    expect(playerItem?.content).toBeDefined()
    expect(sidebarMenu.flatItems.map((menuItem) => menuItem.id)).not.toContain('view-as-player')
    expect(playerTopbarMenu.flatItems.map((menuItem) => menuItem.id)).not.toContain(
      'view-as-player',
    )
    expect(noPlayersTopbarMenu.flatItems.map((menuItem) => menuItem.id)).not.toContain(
      'view-as-player',
    )
  })

  it('checks the viewed player and clears view-as when selecting that player again', async () => {
    const setViewAsPlayerId = vi.fn()
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: createServices({
        viewAsPlayer: { viewAsPlayerId: 'player-1' as never, setViewAsPlayerId },
      }),
      contributors: editorContextMenuContributors,
      commands: editorContextMenuCommands,
      groupConfig,
    })

    const viewAsItem = menu.flatItems.find((menuItem) => menuItem.id === 'view-as-player')
    const playerItem = viewAsItem?.children?.find((menuItem) => menuItem.id === 'view-as-player-0')

    expect(viewAsItem).toMatchObject({
      label: 'View as Player...',
      group: 'share',
      checked: true,
    })
    expect(playerItem).toMatchObject({
      label: 'Mina',
      checked: true,
      closeOnSelect: false,
    })

    await playerItem?.onSelect()

    expect(setViewAsPlayerId).toHaveBeenCalledExactlyOnceWith(undefined)
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

  it('preserves contributor items without scope-based suppression', () => {
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
          },
        ],
      },
    ] satisfies ReadonlyArray<ContextMenuContributor<MenuContext, Record<string, never>>>

    const menu = buildMenu({
      context: sidebarCtx(),
      services,
      contributors,
      commands,
      groupConfig,
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual([
      'selection-duplicate',
      'target-duplicate',
    ])
  })
})
