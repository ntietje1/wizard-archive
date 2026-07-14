import type { ResourceId } from '../../../resources/domain-id'
import { Eye, EyeOff } from 'lucide-react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'

import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import type { AnyItem } from '../../../workspace/items'
import type { WorkspaceMenuContext } from '../../../workspace/menu-context'
import { VIEW_CONTEXT } from '../../../workspace/view-context'
import { buildMenu } from '../../../context-menu/menu-builder'
import { workspaceContextMenuGroupConfig } from '../../../workspace/context-menu/group-config'
import { mapPinContextMenuCommands, mapPinContextMenuContributors } from '../menu'
import type { WorkspaceMapPinContextMenuServices } from '../menu'
import { createMapPinActions } from '../actions'
import { createMapPinMenuService } from '../service'
import {
  sidebarItemContextMenuCommands,
  sidebarItemContextMenuContributors,
} from '../../../workspace/context-menu/sidebar-item-menu'
import type { WorkspaceSidebarItemContextMenuServices } from '../../../workspace/context-menu/sidebar-item-menu'

function createStubMapPinActions(): WorkspaceMapPinContextMenuServices['actions']['mapPins'] {
  return {
    pinToMap: vi.fn(),
    removeMapPin: vi.fn(),
    moveMapPin: vi.fn(),
    togglePinVisibility: vi.fn(),
  }
}

const baseMapPinMenuService: WorkspaceMapPinContextMenuServices['mapPins'] = {
  getActiveMap: () => ({
    id: 'map_1' as never,
    pinnedItemIds: new Set(),
  }),
  getActivePin: () => null,
  getPinOperations: () => ({
    removeMapPin: vi.fn(),
    updateMapPinVisibility: vi.fn(),
  }),
  requestPinPlacement: vi.fn(),
  requestPinMove: vi.fn(),
  getUnpinnedMapItems: () => [],
  isActiveMapItem: () => false,
  isPinnedOnActiveMap: () => false,
  hasPinContext: () => false,
  canEditActiveMap: () => true,
  getActivePinVisible: () => undefined,
}

function createServices({
  mapPins,
}: {
  mapPins?: Partial<WorkspaceMapPinContextMenuServices['mapPins']>
} = {}): WorkspaceMapPinContextMenuServices {
  return {
    actions: {
      mapPins: createStubMapPinActions(),
    },
    mapPins: {
      ...baseMapPinMenuService,
      ...mapPins,
    },
  }
}

function sidebarContext(overrides: Partial<WorkspaceMenuContext> = {}): WorkspaceMenuContext {
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

describe('map pin context menu', () => {
  it('requests map placement for unpinned selected sidebar items', async () => {
    const selectedItems = [createNote(), createFile()]
    const activeMap = createGameMap()
    const requestPinPlacement = vi.fn()
    const mapPins = createMapPinMenuService({
      activeMap: {
        id: activeMap.id,
        pinnedItemIds: new Set(),
      },
      canEditActiveMap: true,
      activePin: null,
      pinOperations: {
        removeMapPin: vi.fn(),
        updateMapPinVisibility: vi.fn(),
      },
      pinRequests: {
        requestPinMove: vi.fn(),
        requestPinPlacement,
      },
    })
    const actions = createMapPinActions({ mapPins })

    await actions.pinToMap(
      sidebarContext({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
    )

    expect(requestPinPlacement).toHaveBeenCalledExactlyOnceWith({
      itemIds: selectedItems.map((item) => item.id),
    })
  })

  it('requests active pin move through the map view', async () => {
    const item = createNote()
    const activePin = {
      id: 'pin_1' as never,
      item,
      visible: true,
    }
    const requestPinMove = vi.fn()
    const mapPins = createMapPinMenuService({
      activeMap: {
        id: 'map_1' as never,
        pinnedItemIds: new Set([item.id]),
      },
      canEditActiveMap: true,
      activePin,
      pinOperations: {
        removeMapPin: vi.fn(),
        updateMapPinVisibility: vi.fn(),
      },
      pinRequests: {
        requestPinMove,
        requestPinPlacement: vi.fn(),
      },
    })
    const actions = createMapPinActions({ mapPins })

    await actions.moveMapPin(sidebarContext({ item }))

    expect(requestPinMove).toHaveBeenCalledExactlyOnceWith({ pinId: activePin.id })
  })

  it('pins multiple selected sidebar items to the active map', () => {
    const selectedItems = [createNote(), createFile()]
    const activeMap = createGameMap()
    const services = createServices({
      mapPins: {
        getActiveMap: () => ({ id: activeMap.id, pinnedItemIds: new Set() }),
        getUnpinnedMapItems: (context) =>
          context.selectedItems.filter((item) => item.id !== activeMap.id),
        isActiveMapItem: (item) => item?.id === activeMap.id,
      },
    })

    const menu = buildMenu({
      context: sidebarContext({
        item: selectedItems[0],
        primaryItem: selectedItems[0],
        selectedItems,
      }),
      services,
      contributors: mapPinContextMenuContributors,
      commands: mapPinContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.map((item) => item.id)).toContain('pin-to-map')
  })

  it('uses generic sidebar item commands for pinned item contexts', async () => {
    const item = createNote()
    const sidebarItemActions: WorkspaceSidebarItemContextMenuServices['actions']['sidebarItem'] = {
      canOpenInNewTab: { status: 'available' },
      open: vi.fn(),
      openInNewTab: vi.fn(),
      rename: vi.fn(),
      showInSidebar: vi.fn(),
      toggleBookmark: vi.fn(),
    }
    const services: WorkspaceMapPinContextMenuServices & WorkspaceSidebarItemContextMenuServices = {
      ...createServices({
        mapPins: {
          getActivePin: () => ({
            id: 'pin_1' as never,
            item,
            visible: true,
          }),
          hasPinContext: () => true,
        },
      }),
      actions: {
        mapPins: createStubMapPinActions(),
        sidebarItem: sidebarItemActions,
      },
    }

    const menu = buildMenu({
      context: sidebarContext({
        item,
        primaryItem: item,
        selectedItems: [item],
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
      services,
      contributors: [...sidebarItemContextMenuContributors, ...mapPinContextMenuContributors],
      commands: {
        ...sidebarItemContextMenuCommands,
        ...mapPinContextMenuCommands,
      },
      groupConfig: workspaceContextMenuGroupConfig,
    })
    const showInSidebarItem = menu.flatItems.find((menuItem) => menuItem.id === 'show-in-sidebar')
    const openItem = menu.flatItems.find((menuItem) => menuItem.id === 'open')
    const openInNewTabItem = menu.flatItems.find((menuItem) => menuItem.id === 'open-in-new-tab')

    expect(openItem).toMatchObject({
      commandId: 'open',
      label: 'Open',
    })
    expect(openInNewTabItem).toMatchObject({
      commandId: 'openInNewTab',
      label: 'Open in New Tab',
    })
    expect(showInSidebarItem).toMatchObject({
      commandId: 'showInSidebar',
      label: 'Show in Sidebar',
    })

    await openItem?.onSelect()
    await openInNewTabItem?.onSelect()
    await showInSidebarItem?.onSelect()

    expect(sidebarItemActions.open).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        item,
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
    )
    expect(sidebarItemActions.openInNewTab).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        item,
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
    )
    expect(sidebarItemActions.showInSidebar).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        item,
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
    )
  })

  it('exposes executable map pin edit actions for the active map pin context', async () => {
    const item = createNote()
    const mapPinActions = createStubMapPinActions()
    const services = createServices({
      mapPins: {
        getActivePin: () => ({
          id: 'pin_1' as never,
          item,
          visible: true,
        }),
        hasPinContext: () => true,
        canEditActiveMap: () => true,
        getActivePinVisible: () => true,
      },
    })
    services.actions.mapPins = mapPinActions

    const menu = buildMenu({
      context: sidebarContext({
        item,
        primaryItem: item,
        selectedItems: [item],
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
      services,
      contributors: mapPinContextMenuContributors,
      commands: mapPinContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    expect(menu.flatItems.map((menuItem) => menuItem.id)).toEqual([
      'hide-pin',
      'move-map-pin',
      'remove-map-pin',
    ])

    for (const menuItem of menu.flatItems) {
      await menuItem.onSelect()
    }

    expect(mapPinActions.togglePinVisibility).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ item, surface: VIEW_CONTEXT.MAP_VIEW }),
    )
    expect(mapPinActions.moveMapPin).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ item, surface: VIEW_CONTEXT.MAP_VIEW }),
    )
    expect(mapPinActions.removeMapPin).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ item, surface: VIEW_CONTEXT.MAP_VIEW }),
    )
  })

  it('hides map pin edit actions when the active map cannot be edited', () => {
    const item = createNote()
    const services = createServices({
      mapPins: {
        getActivePin: () => ({
          id: 'pin_1' as never,
          item,
          visible: true,
        }),
        hasPinContext: () => true,
        canEditActiveMap: () => false,
        getActivePinVisible: () => true,
      },
    })

    const menu = buildMenu({
      context: sidebarContext({
        item,
        primaryItem: item,
        selectedItems: [item],
        surface: VIEW_CONTEXT.MAP_VIEW,
      }),
      services,
      contributors: mapPinContextMenuContributors,
      commands: mapPinContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const itemIds = menu.flatItems.map((menuItem) => menuItem.id)
    expect(itemIds).not.toContain('hide-pin')
    expect(itemIds).not.toContain('show-pin')
    expect(itemIds).not.toContain('move-map-pin')
    expect(itemIds).not.toContain('remove-map-pin')
  })

  it('hides map pin edit actions outside the map view surface', () => {
    const item = createNote()
    const services = createServices({
      mapPins: {
        getActivePin: () => ({
          id: 'pin_1' as never,
          item,
          visible: true,
        }),
        hasPinContext: () => true,
        canEditActiveMap: () => true,
        getActivePinVisible: () => true,
      },
    })

    const menu = buildMenu({
      context: sidebarContext({
        item,
        primaryItem: item,
        selectedItems: [item],
        surface: VIEW_CONTEXT.SIDEBAR,
      }),
      services,
      contributors: mapPinContextMenuContributors,
      commands: mapPinContextMenuCommands,
      groupConfig: workspaceContextMenuGroupConfig,
    })

    const itemIds = menu.flatItems.map((menuItem) => menuItem.id)
    expect(itemIds).not.toContain('hide-pin')
    expect(itemIds).not.toContain('show-pin')
    expect(itemIds).not.toContain('move-map-pin')
    expect(itemIds).not.toContain('remove-map-pin')
  })

  it('keeps the pin visibility label and icon in sync', () => {
    const visibleMenu = buildPinVisibilityMenu(true)
    const hiddenMenu = buildPinVisibilityMenu(false)

    expect(visibleMenu).toMatchObject({ label: 'Hide Pin', icon: EyeOff })
    expect(hiddenMenu).toMatchObject({ label: 'Show Pin', icon: Eye })
  })
})

function buildPinVisibilityMenu(visible: boolean) {
  const item = createNote()
  const services = createServices({
    mapPins: {
      getActivePin: () => ({
        id: 'pin_1' as never,
        item,
        visible,
      }),
      hasPinContext: () => true,
      canEditActiveMap: () => true,
      getActivePinVisible: () => visible,
    },
  })

  const menu = buildMenu({
    context: sidebarContext({
      item,
      primaryItem: item,
      selectedItems: [item],
      surface: VIEW_CONTEXT.MAP_VIEW,
    }),
    services,
    contributors: mapPinContextMenuContributors,
    commands: mapPinContextMenuCommands,
    groupConfig: workspaceContextMenuGroupConfig,
  })

  return (
    menu.flatItems.find((menuItem) => menuItem.id === 'hide-pin') ??
    menu.flatItems.find((menuItem) => menuItem.id === 'show-pin')
  )
}

let sidebarItemSequence = 0

function createNote(): AnyItem {
  return createSidebarItem(RESOURCE_TYPES.notes, 'Note')
}

function createFile(): AnyItem {
  return createSidebarItem(RESOURCE_TYPES.files, 'File')
}

function createGameMap(): AnyItem {
  return createSidebarItem(RESOURCE_TYPES.gameMaps, 'Map')
}

function createSidebarItem(type: string, name: string): AnyItem {
  sidebarItemSequence += 1
  return {
    createdAt: 0,
    id: `${type}_${sidebarItemSequence}` as ResourceId,
    allPermissionLevel: null,
    campaignId: 'campaign-1',
    color: null,
    createdBy: 'user-1',
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name,
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    slug: `${type}-${sidebarItemSequence}`,
    status: RESOURCE_STATUS.active,
    type,
    updatedBy: null,
    updatedTime: null,
  } as unknown as AnyItem
}
