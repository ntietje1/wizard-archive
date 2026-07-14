import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { WORKSPACE_MODE } from '../../../../../../shared/workspace/workspace-mode'
import type { ContextMenuCommand, ContextMenuContributor } from '../../../context-menu/types'
import type { WorkspaceMenuContext } from '../../menu-context'
import { VIEW_CONTEXT } from '../../view-context'
import { buildMenu } from '../../../context-menu/menu-builder'
import { workspaceContextMenuCommands, workspaceContextMenuContributors } from '../registry'
import type { WorkspaceContextMenuServices } from '../registry'
import { workspaceContextMenuGroupConfig } from '../group-config'
import { creationContextMenuCommands, creationContextMenuContributors } from '../creation-menu'
import type * as CreationContextMenuModule from '../creation-menu'
import type { WorkspaceCreationContextMenuServices } from '../creation-menu'
import { downloadContextMenuCommands, downloadContextMenuContributors } from '../download-menu'
import type { WorkspaceDownloadContextMenuServices } from '../download-menu'
import {
  noteContextMenuCommands,
  noteContextMenuContributors,
} from '../../../notes/context-menu/menu'
import type { WorkspaceNoteContextMenuServices } from '../../../notes/context-menu/menu'
import { sharingContextMenuCommands, sharingContextMenuContributors } from '../sharing-menu'
import type { WorkspaceSharingContextMenuServices } from '../sharing-menu'
import {
  sidebarItemContextMenuCommands,
  sidebarItemContextMenuContributors,
} from '../sidebar-item-menu'
import type { WorkspaceSidebarItemContextMenuServices } from '../sidebar-item-menu'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../../test/sidebar-item-factory'
import { DOMAIN_ID_KIND } from '../../../resources/domain-id'
import { testDomainId } from '../../../test/domain-id'

const PLAYER_ID = testDomainId(DOMAIN_ID_KIND.campaignMember, 'context_menu_player')
const PLAYER_MENU_ITEM_ID = `view-as-player-${PLAYER_ID}`

function createActions(): WorkspaceContextMenuServices['actions'] {
  return {
    sidebarItem: {
      canOpenInNewTab: { status: 'available' },
      open: vi.fn(),
      openInNewTab: vi.fn(),
      rename: vi.fn(),
      showInSidebar: vi.fn(),
      toggleBookmark: vi.fn(),
    },
    creation: {
      createNote: vi.fn(),
      createFolder: vi.fn(),
      createMap: vi.fn(),
      createFile: vi.fn(),
      createCanvas: vi.fn(),
    },
    sharing: {
      setGeneralAccessLevel: vi.fn(),
    },
    download: {
      downloadItems: vi.fn(),
      downloadAll: vi.fn(),
    },
    filesystem: {
      delete: vi.fn(),
      paste: vi.fn(),
      duplicate: vi.fn(),
      restore: vi.fn(),
      permanentlyDelete: vi.fn(),
      emptyTrash: vi.fn(),
    },
    itemEdit: {
      editMap: vi.fn(),
      editFile: vi.fn(),
      editItem: vi.fn(),
    },
  }
}

function createServices({
  canCreateItems = true,
  filesystem: filesystemOverrides,
  viewAsPlayer: viewAsPlayerOverrides,
  sidebarItemSharing: sidebarItemSharingOverrides,
  blockShare: blockShareOverrides,
}: {
  canCreateItems?: boolean
  filesystem?: Partial<WorkspaceContextMenuServices['filesystem']>
  viewAsPlayer?: Partial<AvailableViewAsPlayerService>
  sidebarItemSharing?: WorkspaceContextMenuServices['sidebarItemSharing']
  blockShare?: Partial<TestBlockShareService>
} = {}): WorkspaceContextMenuServices {
  return {
    actions: createActions(),
    canCreateItems,
    filesystem: { ...baseFilesystemService, ...filesystemOverrides },
    workspaceMode: createBaseWorkspaceModeService(),
    panels: createBasePanelService(),
    viewAsPlayer: { ...createBaseViewAsPlayerService(), ...viewAsPlayerOverrides },
    sidebarItemSharing: {
      ...createBaseResourceItemSharingService(),
      ...sidebarItemSharingOverrides,
    },
    blockShare: { ...createBaseBlockShareService(), ...blockShareOverrides },
  }
}

type AvailableViewAsPlayerService = Extract<
  WorkspaceSharingContextMenuServices['viewAsPlayer'],
  { status: 'available' }
>

const baseFilesystemService: WorkspaceContextMenuServices['filesystem'] = {
  canDeleteItemsForever: (items) =>
    items.length > 0 && items.every((item) => item.isTrashed === true),
  canDuplicateItems: (items) =>
    items.length > 0 &&
    items.every(
      (item) => item.isTrashed !== true && item.myPermissionLevel === PERMISSION_LEVEL.FULL_ACCESS,
    ),
  canEmptyTrash: true,
  canPasteIntoTarget: () => false,
  canRestoreItems: (items) => items.length > 0 && items.every((item) => item.isTrashed === true),
  canTrashItems: (items) =>
    items.length > 0 &&
    items.every(
      (item) => item.isTrashed !== true && item.myPermissionLevel === PERMISSION_LEVEL.FULL_ACCESS,
    ),
}

function createBaseViewAsPlayerService(): AvailableViewAsPlayerService {
  return {
    status: 'available',
    viewAsPlayerId: undefined,
    setViewAsPlayerId: vi.fn(),
    playerMembers: [
      {
        id: PLAYER_ID,
        displayName: 'Mina',
        username: 'mina',
        imageUrl: 'https://example.com/mina.png',
      } as AvailableViewAsPlayerService['playerMembers'][number],
    ],
  }
}

function createBaseResourceItemSharingService(): WorkspaceContextMenuServices['sidebarItemSharing'] {
  return {
    status: 'available',
    renderPanel: vi.fn(() => 'share-panel'),
  }
}

function createBaseWorkspaceModeService(): WorkspaceContextMenuServices['workspaceMode'] {
  return {
    workspaceMode: WORKSPACE_MODE.EDITOR,
    canEdit: true,
    setWorkspaceMode: vi.fn(),
  }
}

function createBasePanelService(): WorkspaceContextMenuServices['panels'] {
  return {
    getPanelItems: () => [],
    isPanelActive: vi.fn(() => false),
    activatePanel: vi.fn(),
  }
}

interface TestBlockShareService {
  canOpen: (context: WorkspaceMenuContext) => boolean
  canToggleAllPlayersPermission: () => boolean
  getBlockCount: (context: WorkspaceMenuContext) => number
  getAllPlayersPermissionLevel: () => 'hidden' | 'visible' | 'mixed'
  toggleAllPlayersPermission: () => void
}

function createBaseBlockShareService(): TestBlockShareService {
  return {
    canOpen: vi.fn(() => false),
    canToggleAllPlayersPermission: vi.fn(() => true),
    getBlockCount: vi.fn(() => 0),
    getAllPlayersPermissionLevel: vi.fn((): 'hidden' => 'hidden'),
    toggleAllPlayersPermission: vi.fn(),
  }
}

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

describe('buildMenu', () => {
  it('rejects duplicate command ids while composing workspace commands', async () => {
    vi.resetModules()
    vi.doMock('../creation-menu', async (importOriginal) => {
      const actual = await importOriginal<typeof CreationContextMenuModule>()
      return {
        ...actual,
        creationContextMenuCommands: {
          open: {
            id: 'open',
            run: vi.fn(),
          },
        },
      }
    })

    try {
      await expect(import('../registry')).rejects.toThrow(
        'Duplicate workspace context menu command id: open',
      )
    } finally {
      vi.doUnmock('../creation-menu')
      vi.resetModules()
    }
  })

  it('routes command execution through domain-owned action fragments', async () => {
    const services = createServices()
    const context = sidebarCtx({ item: createNote() })

    await workspaceContextMenuCommands.open.run(context, services)
    await workspaceContextMenuCommands.createNote.run(context, services)
    await workspaceContextMenuCommands.setGeneralAccessLevel.run(
      context,
      services,
      PERMISSION_LEVEL.VIEW,
    )
    await workspaceContextMenuCommands.downloadItems.run(context, services)
    await workspaceContextMenuCommands.paste.run(context, services)
    await workspaceContextMenuCommands.delete.run(context, services)

    expect(services.actions.sidebarItem.open).toHaveBeenCalledExactlyOnceWith(context)
    await workspaceContextMenuCommands.openInNewTab.run(context, services)
    expect(services.actions.sidebarItem.openInNewTab).toHaveBeenCalledExactlyOnceWith(context)
    expect(services.actions.creation.createNote).toHaveBeenCalledExactlyOnceWith(context)
    expect(services.actions.sharing.setGeneralAccessLevel).toHaveBeenCalledExactlyOnceWith(
      context,
      PERMISSION_LEVEL.VIEW,
    )
    expect(services.actions.download.downloadItems).toHaveBeenCalledExactlyOnceWith(context)
    expect(services.actions.filesystem.paste).toHaveBeenCalledExactlyOnceWith(context)
    expect(services.actions.filesystem.delete).toHaveBeenCalledExactlyOnceWith(context)
  })

  it('builds sidebar item menus with only sidebar item services', () => {
    const actions = createActions()
    const sidebarServices: WorkspaceSidebarItemContextMenuServices = {
      actions: {
        sidebarItem: actions.sidebarItem,
      },
    }
    const menu = buildMenu({
      context: sidebarCtx({ item: createNote() }),
      services: sidebarServices,
      contributors: sidebarItemContextMenuContributors,
      commands: sidebarItemContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('open')
    expect(ids).toContain('open-in-new-tab')
    expect(ids).toContain('rename')
  })

  it('omits sidebar open-in-new-tab when separate item navigation is unsupported', () => {
    const actions = createActions()
    const sidebarServices: WorkspaceSidebarItemContextMenuServices = {
      actions: {
        sidebarItem: {
          ...actions.sidebarItem,
          canOpenInNewTab: { status: 'unsupported', reason: 'not_available' },
        } as WorkspaceSidebarItemContextMenuServices['actions']['sidebarItem'],
      },
    }
    const menu = buildMenu({
      context: sidebarCtx({ item: createNote() }),
      services: sidebarServices,
      contributors: sidebarItemContextMenuContributors,
      commands: sidebarItemContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('open')
    expect(ids).not.toContain('open-in-new-tab')
  })

  it('builds creation menus with only creation services', () => {
    const actions = createActions()
    const creationServices: WorkspaceCreationContextMenuServices = {
      actions: {
        creation: actions.creation,
      },
      canCreateItems: true,
    }
    const menu = buildMenu({
      context: sidebarCtx({ item: createFolder() }),
      services: creationServices,
      contributors: creationContextMenuContributors,
      commands: creationContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const createNew = menu.flatItems.find((i) => i.id === 'create-new-submenu')
    expect(createNew?.children?.map((item) => item.commandId)).toEqual([
      'createNote',
      'createFolder',
      'createMap',
      'createCanvas',
      'createFile',
    ])
  })

  it('builds download menus with only download services', () => {
    const actions = createActions()
    const downloadServices: WorkspaceDownloadContextMenuServices = {
      actions: {
        download: actions.download,
      },
    }
    const menu = buildMenu({
      context: sidebarCtx({ item: createNote(), selectedItems: [createNote()] }),
      services: downloadServices,
      contributors: downloadContextMenuContributors,
      commands: downloadContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.map((i) => i.id)).toContain('download-items')
  })

  it('builds note menus with only note services', () => {
    const toggleAllPlayersPermission = vi.fn()
    const noteServices: WorkspaceNoteContextMenuServices = {
      blockShare: {
        ...createBaseBlockShareService(),
        canOpen: () => true,
        getBlockCount: () => 2,
        getAllPlayersPermissionLevel: () => 'hidden',
        toggleAllPlayersPermission,
      },
    }
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        domainContext: { noteBlockId: 'block-1' },
      }),
      services: noteServices,
      contributors: noteContextMenuContributors,
      commands: noteContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Share 2 Blocks',
      closeOnSelect: false,
    })
  })

  it('builds note value menus with only note services', () => {
    const openValueInline = vi.fn()
    const noteServices: WorkspaceNoteContextMenuServices = {
      blockShare: createBaseBlockShareService(),
    }
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        domainContext: {
          isEditorTextContext: true,
          valueInlineId: 'value-1',
          valueInlineEditable: true,
          openValueInline,
        },
      }),
      services: noteServices,
      contributors: noteContextMenuContributors,
      commands: noteContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual(['edit-value-inline'])
  })

  it('builds sharing menus with only sharing services', async () => {
    const note = createNote()
    const setGeneralAccessLevel = vi.fn()
    const setViewAsPlayerId = vi.fn()
    const renderPanel = vi.fn(() => 'share-panel')
    const sharingServices: WorkspaceSharingContextMenuServices = {
      actions: {
        sharing: {
          setGeneralAccessLevel,
        },
      },
      sidebarItemSharing: {
        status: 'available',
        renderPanel,
      },
      viewAsPlayer: {
        ...createBaseViewAsPlayerService(),
        setViewAsPlayerId,
      },
    }
    const sidebarMenu = buildMenu({
      context: sidebarCtx({
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: sharingServices,
      contributors: sharingContextMenuContributors,
      commands: sharingContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const topbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: sharingServices,
      contributors: sharingContextMenuContributors,
      commands: sharingContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareItem = sidebarMenu.flatItems.find((item) => item.id === 'share-items')
    const viewAsItem = topbarMenu.flatItems.find((item) => item.id === 'view-as-player')
    const playerItem = viewAsItem?.children?.find((item) => item.id === PLAYER_MENU_ITEM_ID)

    expect(shareItem?.submenuContent).toBe('share-panel')
    expect(renderPanel).toHaveBeenCalledWith([note])
    expect(playerItem).toMatchObject({ label: 'Mina', closeOnSelect: false })

    await sharingContextMenuCommands.setGeneralAccessLevel.run(
      {
        surface: VIEW_CONTEXT.SIDEBAR,
        item: note,
        selectedItems: [note],
      },
      sharingServices,
      PERMISSION_LEVEL.VIEW,
    )
    await playerItem?.onSelect()

    expect(setGeneralAccessLevel).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ item: note }),
      PERMISSION_LEVEL.VIEW,
    )
    expect(setViewAsPlayerId).toHaveBeenCalledExactlyOnceWith(PLAYER_ID)
  })

  it('DM sees sidebar item and filesystem actions on a note in sidebar', () => {
    const services = createServices()
    const menu = buildMenu({
      context: sidebarCtx({ item: createNote() }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('open')
    expect(ids).toContain('rename')
    expect(ids).toContain('delete')
    expect(ids).toContain('toggle-bookmark')
  })

  it('aggregates item edit and panel menus through the workspace registry', () => {
    const services = createServices()
    const note = createNote()
    const sidebarMenu = buildMenu({
      context: sidebarCtx({ item: note, primaryItem: note, selectedItems: [note] }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const topbarMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(sidebarMenu.flatItems.map((item) => item.id)).toContain('edit-item')
    expect(topbarMenu.flatItems.map((item) => item.id)).toContain('toggle-reading-mode')
  })

  it('map view sidebar items expose generic open actions', () => {
    const services = createServices()
    const note = createNote()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.MAP_VIEW,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((item) => item.id)
    expect(ids).toEqual(expect.arrayContaining(['open', 'open-in-new-tab']))
  })

  it('multi-selection keeps batch actions', () => {
    const services = createServices()
    const selectedItems = [createNote(), createFile()]
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(['delete', 'download-items', 'duplicate']))
  })

  it('folder view keeps batch actions', () => {
    const services = createServices()
    const selectedItems = [createNote(), createFile()]
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.FOLDER_VIEW,
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining(['duplicate', 'delete']))
  })

  it('shows Paste when the filesystem clipboard can paste', () => {
    const services = createServices()
    const folder = createFolder()
    const menuWithClipboard = buildMenu({
      context: sidebarCtx({ item: folder }),
      services: {
        ...services,
        filesystem: { ...baseFilesystemService, canPasteIntoTarget: () => true },
      },
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menuWithClipboard.flatItems.map((item) => item.id)).toContain('paste')
  })

  it('DM sees "New..." submenu on a folder', () => {
    const services = createServices()
    const menu = buildMenu({
      context: sidebarCtx({ item: createFolder() }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
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

  it('file item shows the unified download action', () => {
    const services = createServices()
    const menu = buildMenu({
      context: sidebarCtx({ item: createFile() }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('download-items')
  })

  it('shows sidebar reveal for item contexts outside the sidebar', () => {
    const services = createServices()
    const note = createNote()
    const itemSurfaces = Object.values(VIEW_CONTEXT).filter(
      (surface) => surface !== VIEW_CONTEXT.SIDEBAR,
    )

    for (const surface of itemSurfaces) {
      const menu = buildMenu({
        context: sidebarCtx({
          surface,
          item: note,
          primaryItem: note,
          selectedItems: [note],
        }),
        services,
        contributors: workspaceContextMenuContributors,
        commands: workspaceContextMenuCommands,
        groupConfig: workspaceContextMenuGroupConfig,
      })

      expect(menu.flatItems.map((item) => item.id)).toContain('show-in-sidebar')
    }
  })

  it('mixed multi-selection shows one unified download action', () => {
    const services = createServices()
    const selectedItems = [createNote(), createFile(), createGameMap()]
    const menu = buildMenu({
      context: sidebarCtx({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids.filter((id) => id.startsWith('download'))).toEqual(['download-items'])
  })

  it('renders share as submenu content instead of an action command', () => {
    const note = createNote()
    const renderPanel = vi.fn(() => 'share-panel')
    const shareServices = createServices({
      sidebarItemSharing: { status: 'available', renderPanel },
    })
    const menu = buildMenu({
      context: sidebarCtx({
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      services: shareServices,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareItem = menu.flatItems.find((i) => i.id === 'share-items')
    expect(shareItem?.submenuContent).toBe('share-panel')
    expect(renderPanel).toHaveBeenCalledExactlyOnceWith([note])
  })

  it('trashed item shows restore and permanently-delete', () => {
    const services = createServices()
    const item = createNote({ status: 'trashed', deletionTime: Date.now() })
    const ctx: WorkspaceMenuContext = {
      item,
      selectedItems: [item],
      surface: VIEW_CONTEXT.TRASH_VIEW,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    }
    const menu = buildMenu({
      context: ctx,
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('restore')
    expect(ids).toContain('permanently-delete')
    expect(ids).toContain('empty-trash')
  })

  it('root context (no item) shows "New..." and download-all for DM in sidebar', () => {
    const services = createServices()
    const ctx: WorkspaceMenuContext = {
      item: undefined,
      selectedItems: [],
      surface: VIEW_CONTEXT.SIDEBAR,
      permissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      rootOperations: { canDownloadAll: true },
    }
    const menu = buildMenu({
      context: ctx,
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).toContain('create-new-submenu')
    expect(ids).toContain('download-all')
  })

  it('hides root download-all without root download authority', () => {
    const services = createServices({ canCreateItems: false })
    const ctx = {
      item: undefined,
      selectedItems: [],
      surface: VIEW_CONTEXT.SIDEBAR,
      permissionLevel: PERMISSION_LEVEL.VIEW,
      rootOperations: { canDownloadAll: false },
    } as WorkspaceMenuContext
    const menu = buildMenu({
      context: ctx,
      services,
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const ids = menu.flatItems.map((i) => i.id)
    expect(ids).not.toContain('download-all')
  })

  it('shows value editing for editable value inline content', () => {
    const valueMenu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: undefined,
        selectedItems: [],
        domainContext: {
          valueInlineId: 'value-1',
          valueInlineEditable: true,
        },
      }),
      services: createServices(),
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(valueMenu.flatItems.map((item) => item.id)).toContain('edit-value-inline')
  })

  it('shares hidden blocks with all players from the note editor context menu', async () => {
    const toggleAllPlayersPermission = vi.fn()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        domainContext: { noteBlockId: 'block-1' },
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          getBlockCount: () => 2,
          getAllPlayersPermissionLevel: () => 'hidden',
          toggleAllPlayersPermission,
        },
      }),
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Share 2 Blocks',
      group: 'share',
      closeOnSelect: false,
    })

    await shareBlocksItem?.onSelect()

    expect(toggleAllPlayersPermission).toHaveBeenCalledOnce()
  })

  it('unshares all-player-visible blocks from the note editor context menu', async () => {
    const toggleAllPlayersPermission = vi.fn()
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        domainContext: { noteBlockId: 'block-1' },
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          getBlockCount: () => 1,
          getAllPlayersPermissionLevel: () => 'visible',
          toggleAllPlayersPermission,
        },
      }),
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Unshare 1 Block',
      group: 'share',
      closeOnSelect: false,
    })

    await shareBlocksItem?.onSelect()

    expect(toggleAllPlayersPermission).toHaveBeenCalledOnce()
  })

  it('keeps the optimistic block share item visible but disabled while a toggle is pending', () => {
    const menu = buildMenu({
      context: sidebarCtx({
        surface: VIEW_CONTEXT.NOTE_VIEW,
        item: createNote(),
        selectedItems: [],
        domainContext: { noteBlockId: 'block-1' },
      }),
      services: createServices({
        blockShare: {
          canOpen: () => true,
          canToggleAllPlayersPermission: () => false,
          getBlockCount: () => 1,
          getAllPlayersPermissionLevel: () => 'visible',
        },
      }),
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const shareBlocksItem = menu.flatItems.find((item) => item.id === 'share-blocks')

    expect(shareBlocksItem).toMatchObject({
      label: 'Unshare 1 Block',
      disabled: true,
      closeOnSelect: false,
    })
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
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const viewAsItem = topbarMenu.flatItems.find((menuItem) => menuItem.id === 'view-as-player')
    const playerItem = viewAsItem?.children?.find((menuItem) => menuItem.id === PLAYER_MENU_ITEM_ID)
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
        viewAsPlayer: { viewAsPlayerId: PLAYER_ID, setViewAsPlayerId },
      }),
      contributors: workspaceContextMenuContributors,
      commands: workspaceContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const viewAsItem = menu.flatItems.find((menuItem) => menuItem.id === 'view-as-player')
    const playerItem = viewAsItem?.children?.find((menuItem) => menuItem.id === PLAYER_MENU_ITEM_ID)

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

  it('ignores stale view-as player command payloads', () => {
    const setViewAsPlayerId = vi.fn()
    const note = createNote()

    sharingContextMenuCommands.setViewAsPlayer.run(
      sidebarCtx({
        surface: VIEW_CONTEXT.TOPBAR,
        item: note,
        primaryItem: note,
        selectedItems: [note],
      }),
      createServices({
        viewAsPlayer: { setViewAsPlayerId },
      }),
      'stale-player-id',
    )

    expect(setViewAsPlayerId).not.toHaveBeenCalled()
  })

  it('preserves contributor items without scope-based suppression', () => {
    const services = createServices()
    const commands = {
      duplicate: {
        id: 'duplicate',
        label: 'Duplicate',
        run: vi.fn(),
      },
    } satisfies Record<string, ContextMenuCommand<WorkspaceMenuContext, Record<string, never>, any>>
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
    ] satisfies ReadonlyArray<ContextMenuContributor<WorkspaceMenuContext, Record<string, never>>>

    const menu = buildMenu({
      context: sidebarCtx(),
      services,
      contributors,
      commands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual([
      'selection-duplicate',
      'target-duplicate',
    ])
  })
})
