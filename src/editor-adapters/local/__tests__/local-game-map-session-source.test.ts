import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createWizardEditorResourceCatalogSource } from '@wizard-archive/editor/adapter'
import type {
  WizardEditorFileSessionReplaceInput,
  WizardEditorItem,
  WizardEditorItemWithContent,
} from '@wizard-archive/editor/adapter'
import type { CampaignId, MapPinId, SidebarItemId, UserProfileId } from 'shared/common/ids'
import { createImportFile } from './helpers/import-file'
import { createLocalGameMapSessionSource } from '../local-game-map-session-source'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'

const TEST_RESOURCE_LOCATION = {
  sidebar: 'sidebar',
} as const satisfies Record<string, WizardEditorItem['location']>
const TEST_RESOURCE_STATUS = {
  active: 'active',
} as const satisfies Record<string, WizardEditorItem['status']>
const TEST_RESOURCE_TYPES = {
  gameMaps: 'gameMap',
  notes: 'note',
} as const satisfies Record<string, WizardEditorItemWithContent['type']>

type LocalMapItemWithContent = Extract<WizardEditorItemWithContent, { type: 'gameMap' }>
type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LocalImportFile = WizardEditorFileSessionReplaceInput['file']

describe('createLocalGameMapSessionSource', () => {
  it('does not mutate maps that are known but not visible', async () => {
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createHiddenMapCatalog(),
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const createResult = session.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'note-market' as SidebarItemId, x: 10, y: 20 }],
    })
    const imageResult = await session.updateMapImage({
      mapId: 'map-docks' as SidebarItemId,
      file: createImportFile(['map'], 'map.txt', { type: 'text/plain' }),
    })

    expect(createResult).toEqual({ status: 'unavailable', reason: 'map_not_found' })
    expect(imageResult).toEqual({ status: 'unavailable', reason: 'map_not_found' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('mutates visible map pins and ignores pins for maps that are known but not visible', () => {
    const dispatch = vi.fn()
    const visibleSession = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createVisibleMapCatalog(),
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(
      visibleSession.pins.update({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
        x: 30,
        y: 40,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinUpdated' } })
    expect(
      visibleSession.pins.setVisibility({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
        isVisible: false,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinVisibilityUpdated' } })
    expect(
      visibleSession.pins.remove({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinRemoved' } })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateMapPin',
      mapPinId: 'map-docks-pin-1',
      x: 30,
      y: 40,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateMapPinVisibility',
      mapPinId: 'map-docks-pin-1',
      isVisible: false,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'removeMapPin',
      mapPinId: 'map-docks-pin-1',
    })
    dispatch.mockClear()

    expect(
      visibleSession.pins.update({
        mapId: 'other-map' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
        x: 50,
        y: 60,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })

    expect(dispatch).not.toHaveBeenCalled()

    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createHiddenMapCatalog(),
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(
      session.pins.update({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
        x: 30,
        y: 40,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })
    expect(
      session.pins.setVisibility({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
        isVisible: false,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })
    expect(
      session.pins.remove({
        mapId: 'map-docks' as SidebarItemId,
        mapPinId: 'map-docks-pin-1' as MapPinId,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('allows a session-created pin item to be re-added after the pin is removed', async () => {
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createVisibleMapCatalog(),
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    const firstCreateResult = await session.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'note-unpinned' as SidebarItemId, x: 12, y: 24 }],
    })
    if (firstCreateResult.status !== 'completed') throw new Error('Expected pins to be created')
    session.pins.remove({
      mapId: 'map-docks' as SidebarItemId,
      mapPinId: firstCreateResult.receipt.pinIds[0]!,
    })
    const secondCreateResult = await session.pins.create({
      mapId: 'map-docks' as SidebarItemId,
      pins: [{ itemId: 'note-unpinned' as SidebarItemId, x: 32, y: 48 }],
    })
    if (secondCreateResult.status !== 'completed') throw new Error('Expected pins to be created')

    expect(firstCreateResult.receipt.pinIds).toEqual(['local-map-pin-3'])
    expect(secondCreateResult.receipt.pinIds).toEqual(['local-map-pin-4'])
    expect(dispatch).toHaveBeenCalledWith({
      type: 'createMapPins',
      mapId: 'map-docks',
      pins: [
        expect.objectContaining({
          id: 'local-map-pin-3',
          itemId: 'note-unpinned',
        }),
      ],
      nextLocalMapPinIndex: 4,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'removeMapPin',
      mapPinId: 'local-map-pin-3',
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'createMapPins',
      mapId: 'map-docks',
      pins: [
        expect.objectContaining({
          id: 'local-map-pin-4',
          itemId: 'note-unpinned',
        }),
      ],
      nextLocalMapPinIndex: 5,
    })
  })

  it('ignores stale map image reads after a newer upload starts for the same map', async () => {
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createVisibleMapCatalog(),
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const firstRead = createDeferred<ArrayBuffer>()
    const firstUpdate = session.updateMapImage({
      mapId: 'map-docks' as SidebarItemId,
      file: createControlledImportFile('first.svg', 'image/svg+xml', firstRead.promise),
    })
    const secondUpdate = await session.updateMapImage({
      mapId: 'map-docks' as SidebarItemId,
      file: createImportFile(['<svg>second</svg>'], 'second.svg', { type: 'image/svg+xml' }),
    })

    firstRead.resolve(textArrayBuffer('<svg>first</svg>'))

    await expect(firstUpdate).resolves.toEqual({
      status: 'unavailable',
      reason: 'stale_map_image',
    })
    expect(secondUpdate).toMatchObject({
      status: 'completed',
      receipt: { kind: 'mapImageUpdated' },
    })
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'updateMapImage',
      layerId: null,
      mapId: 'map-docks',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg>second</svg>')}`,
    })
  })
})

function createHiddenMapCatalog() {
  const map = createMapItem()
  const note = createNoteItem()
  return createTestCatalog({
    activeItems: [map, note],
    trashItems: [],
    visibleActiveItems: [note],
  })
}

function createVisibleMapCatalog() {
  const map = createMapItem()
  const note = createNoteItem()
  const unpinnedNote = createNoteItem('note-unpinned', 'Unpinned Note')
  return createTestCatalog({
    activeItems: [map, note, unpinnedNote],
    trashItems: [],
  })
}

function createTestCatalog({
  activeItems,
  trashItems,
  visibleActiveItems,
}: {
  activeItems: Array<WizardEditorItem>
  trashItems: Array<WizardEditorItem>
  visibleActiveItems?: Array<WizardEditorItem>
}) {
  return createWizardEditorResourceCatalogSource({
    activeItems,
    trashItems,
    visibleActiveItems,
    activeError: null,
    activeStatus: 'success',
    refreshActive: () => Promise.resolve(),
    refreshTrash: () => Promise.resolve(),
    trashError: null,
    trashStatus: 'success',
  }).catalog
}

function createMapItem(): LocalMapItemWithContent {
  return {
    ...createBaseItem('map-docks', 'Moonwell Docks'),
    imageAssetId: null,
    imageUrl: null,
    pins: [
      {
        id: 'map-docks-pin-1' as MapPinId,
        createdAt: 1,
        item: createNoteItem(),
        itemId: 'note-market' as SidebarItemId,
        layerId: null,
        mapId: 'map-docks' as SidebarItemId,
        visible: true,
        x: 10,
        y: 20,
      },
    ],
    type: TEST_RESOURCE_TYPES.gameMaps,
  }
}

function createNoteItem(id = 'note-market', name = 'The Lantern Market'): LocalNoteItemWithContent {
  return {
    ...createBaseItem(id, name),
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
    type: TEST_RESOURCE_TYPES.notes,
  }
}

function createBaseItem(id: string, name: string) {
  return {
    id: id as SidebarItemId,
    createdAt: 1,
    allPermissionLevel: null,
    ancestors: [],
    campaignId: 'demo-campaign' as CampaignId,
    color: null,
    createdBy: 'demo-user' as UserProfileId,
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: TEST_RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name: name as WizardEditorItem['name'],
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    slug: id as WizardEditorItem['slug'],
    status: TEST_RESOURCE_STATUS.active,
    updatedBy: null,
    updatedTime: null,
  }
}

function createControlledImportFile(
  name: string,
  contentType: string,
  arrayBuffer: Promise<ArrayBuffer>,
): LocalImportFile {
  return {
    name,
    contentType,
    size: 1,
    arrayBuffer: () => arrayBuffer,
    text: () => Promise.resolve(''),
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function textArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}
