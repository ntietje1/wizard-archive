import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import {
  createWizardEditorResourceCatalogSource,
  parseWizardEditorResourceSlug,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorFileSessionReplaceInput,
  WizardEditorItem,
  WizardEditorItemWithContent,
} from '@wizard-archive/editor/adapter'
import type { UserProfileId } from 'shared/common/ids'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import { testMapPinId } from 'shared/test/map-pin-id'
import { testCampaignId } from 'shared/test/campaign-id'
import { testResourceId } from 'shared/test/resource-id'
import { createImportFile } from './helpers/import-file'
import { createLocalGameMapSessionSource } from '../local-game-map-session-source'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

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
const VISIBLE_MAP_PIN_ID = testMapPinId('map-docks-pin-1')

describe('createLocalGameMapSessionSource', () => {
  it('does not mutate maps that are known but not visible', async () => {
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createHiddenMapCatalog(),
      dispatch,
    })

    const createResult = session.pins.create({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      pins: [{ itemId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote, x: 10, y: 20 }],
    })
    const imageResult = await session.updateMapImage({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
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
    })

    expect(
      visibleSession.pins.update({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
        x: 30,
        y: 40,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinUpdated' } })
    expect(
      visibleSession.pins.setVisibility({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
        isVisible: false,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinVisibilityUpdated' } })
    expect(
      visibleSession.pins.remove({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
      }),
    ).toMatchObject({ status: 'completed', receipt: { kind: 'mapPinRemoved' } })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateMapPin',
      mapPinId: VISIBLE_MAP_PIN_ID,
      x: 30,
      y: 40,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateMapPinVisibility',
      mapPinId: VISIBLE_MAP_PIN_ID,
      isVisible: false,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'removeMapPin',
      mapPinId: VISIBLE_MAP_PIN_ID,
    })
    dispatch.mockClear()

    expect(
      visibleSession.pins.update({
        mapId: testResourceId('other-map'),
        mapPinId: VISIBLE_MAP_PIN_ID,
        x: 50,
        y: 60,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })

    expect(dispatch).not.toHaveBeenCalled()

    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createHiddenMapCatalog(),
      dispatch,
    })

    expect(
      session.pins.update({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
        x: 30,
        y: 40,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })
    expect(
      session.pins.setVisibility({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
        isVisible: false,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })
    expect(
      session.pins.remove({
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        mapPinId: VISIBLE_MAP_PIN_ID,
      }),
    ).toEqual({ status: 'unavailable', reason: 'map_pin_not_found' })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('allows a session-created pin item to be re-added after the pin is removed', async () => {
    const unpinnedNoteId = testResourceId('note-unpinned')
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createVisibleMapCatalog(),
      dispatch,
    })

    const firstCreateResult = await session.pins.create({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      pins: [{ itemId: unpinnedNoteId, x: 12, y: 24 }],
    })
    if (firstCreateResult.status !== 'completed') throw new Error('Expected pins to be created')
    session.pins.remove({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      mapPinId: firstCreateResult.receipt.pinIds[0]!,
    })
    const secondCreateResult = await session.pins.create({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      pins: [{ itemId: unpinnedNoteId, x: 32, y: 48 }],
    })
    if (secondCreateResult.status !== 'completed') throw new Error('Expected pins to be created')

    const firstPinId = firstCreateResult.receipt.pinIds[0]!
    const secondPinId = secondCreateResult.receipt.pinIds[0]!

    expect(firstCreateResult.receipt.pinIds).toHaveLength(1)
    expect(secondCreateResult.receipt.pinIds).toHaveLength(1)
    expect(isUuidV7(firstPinId)).toBe(true)
    expect(isUuidV7(secondPinId)).toBe(true)
    expect(secondPinId).not.toBe(firstPinId)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'createMapPins',
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      pins: [
        expect.objectContaining({
          id: firstPinId,
          itemId: unpinnedNoteId,
        }),
      ],
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'removeMapPin',
      mapPinId: firstPinId,
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'createMapPins',
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      pins: [
        expect.objectContaining({
          id: secondPinId,
          itemId: unpinnedNoteId,
        }),
      ],
    })
  })

  it('ignores stale map image reads after a newer upload starts for the same map', async () => {
    const dispatch = vi.fn()
    const session = createLocalGameMapSessionSource({
      canEdit: true,
      catalog: createVisibleMapCatalog(),
      dispatch,
    })
    const firstRead = createDeferred<ArrayBuffer>()
    const firstUpdate = session.updateMapImage({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
      file: createControlledImportFile('first.svg', 'image/svg+xml', firstRead.promise),
    })
    const secondUpdate = await session.updateMapImage({
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
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
      mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
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
  const unpinnedNote = createNoteItem(testResourceId('note-unpinned'), 'Unpinned Note')
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
    ...createBaseItem(SAMPLE_LOCAL_RESOURCE_IDS.docksMap, 'Moonwell Docks'),
    imageAssetId: null,
    imageUrl: null,
    pins: [
      {
        id: VISIBLE_MAP_PIN_ID,
        createdAt: 1,
        item: createNoteItem(),
        itemId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
        layerId: null,
        mapId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
        visible: true,
        x: 10,
        y: 20,
      },
    ],
    type: TEST_RESOURCE_TYPES.gameMaps,
  }
}

function createNoteItem(
  id = SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
  name = 'The Lantern Market',
): LocalNoteItemWithContent {
  return {
    ...createBaseItem(id, name),
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
    type: TEST_RESOURCE_TYPES.notes,
  }
}

function createBaseItem(id: ResourceId, name: string) {
  return {
    id,
    createdAt: 1,
    allPermissionLevel: null,
    ancestors: [],
    campaignId: testCampaignId('demo-campaign'),
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
    slug: parseWizardEditorResourceSlug(id)!,
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
