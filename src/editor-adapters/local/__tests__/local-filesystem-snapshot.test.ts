import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SHARE_STATUS } from 'shared/block-shares/share-status'

import { createWizardEditorResource } from '@wizard-archive/editor/adapter'
import type { WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'
import {
  createLocalFileSystemSnapshot,
  createLocalWorkspaceInitialNavigation,
} from '../local-filesystem-snapshot'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'
import { SAMPLE_LOCAL_RESOURCE_IDS, SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { LOCAL_WORKSPACE_INITIAL_TIMESTAMP } from '../local-workspace-model'
import { testMapPinId } from 'shared/test/map-pin-id'
import { testNoteBlockId } from 'shared/test/note-block-id'
import { testCampaignMemberId } from 'shared/test/campaign-member-id'
import { testResourceId } from 'shared/test/resource-id'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'

type LocalMapItemWithContent = Extract<WizardEditorItemWithContent, { type: 'gameMap' }>
type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LocalNoteBlock = LocalNoteItemWithContent['content'][number]

afterEach(() => {
  vi.useRealTimers()
})

describe('local filesystem snapshot', () => {
  it('seeds canonical metadata versions for every local demo resource', async () => {
    const workspaces = [
      SAMPLE_LOCAL_WORKSPACE,
      ...Object.values(PUBLIC_DEMO_SCENARIO_IDS).map(
        (scenarioId) => createPublicDemoScenario(scenarioId).workspace,
      ),
    ]

    for (const workspace of workspaces) {
      for (const item of workspace.items) {
        await expect(
          initialResourceMetadataVersion({
            parentId: item.parentId,
            kind: item.type,
            title: canonicalizeResourceTitle(item.title),
            icon: item.iconName ?? null,
            color: item.color ?? null,
            lifecycle: item.status === 'active' ? 'active' : 'trashed',
          }),
        ).resolves.toEqual(item.metadataVersion)
      }
    }
  })

  it('projects stable local item lifecycle timestamps from the workspace model', () => {
    vi.useFakeTimers()
    const createdAt = Date.UTC(2026, 6, 1, 15, 45, 0)
    const updatedAt = Date.UTC(2026, 6, 1, 15, 50, 0)
    const trashedAt = Date.UTC(2026, 6, 1, 15, 55, 0)
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.items = workspace.items.map((item) =>
      item.id === SAMPLE_LOCAL_RESOURCE_IDS.marketNote
        ? { ...item, createdAt, status: 'trash', trashedAt, updatedAt }
        : item,
    )
    const noteId = SAMPLE_LOCAL_RESOURCE_IDS.marketNote

    vi.setSystemTime(new Date('2026-07-01T16:00:00.000Z'))
    const firstNote = createLocalFileSystemSnapshot(workspace).catalog.getKnownItemById(noteId)

    vi.setSystemTime(new Date('2026-07-01T16:01:00.000Z'))
    const secondNote = createLocalFileSystemSnapshot(workspace).catalog.getKnownItemById(noteId)

    expect(firstNote).toMatchObject({
      createdAt: createdAt,
      updatedTime: updatedAt,
      deletionTime: trashedAt,
    })
    expect(secondNote).toMatchObject({
      createdAt: createdAt,
      updatedTime: updatedAt,
      deletionTime: trashedAt,
    })
  })

  it('projects visible local children as roots when their parent is hidden from the viewed player', () => {
    const playerId = testCampaignMemberId('player-hidden-parent')
    const hiddenFolderId = testResourceId('hidden-folder')
    const visibleNoteId = testResourceId('visible-note')
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.selectedViewAsPlayerId = playerId
    workspace.items = [
      {
        ...localItemLifecycle(),
        id: hiddenFolderId,
        parentId: null,
        status: 'active',
        type: 'folder',
        title: 'Hidden Folder',
        description: 'Folder',
      },
      {
        ...localItemLifecycle(),
        id: visibleNoteId,
        parentId: hiddenFolderId,
        status: 'active',
        type: 'note',
        title: 'Visible Note',
        description: 'Session note',
      },
    ]
    workspace.noteBodiesById = { [visibleNoteId]: 'Visible note body' }
    workspace.memberItemPermissionsById = {
      [visibleNoteId]: { [playerId]: PERMISSION_LEVEL.VIEW },
    }

    const snapshot = createLocalFileSystemSnapshot(workspace)
    const repeatedSnapshot = createLocalFileSystemSnapshot(workspace)
    const share = snapshot.catalog.getKnownItemById(visibleNoteId)?.shares[0]

    expect(isUuidV7(share!.id)).toBe(true)
    expect(repeatedSnapshot.catalog.getKnownItemById(visibleNoteId)?.shares[0].id).toBe(share!.id)
    expect(snapshot.catalog.getKnownItemById(visibleNoteId)?.parentId).toBeNull()
    expect(snapshot.catalog.getVisibleItemById(visibleNoteId)?.parentId).toBeNull()
    expect(snapshot.catalog.getVisibleRoots().map((item) => item.id)).toEqual([visibleNoteId])
  })

  it('normalizes stale local view-as player ids before projecting the catalog', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const snapshot = createLocalFileSystemSnapshot({
      ...scenario.workspace,
      selectedViewAsPlayerId: testCampaignMemberId('missing-player'),
    })
    const note = snapshot.catalog.getKnownItemById(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)

    expect(snapshot.workspace.selectedViewAsPlayerId).toBeUndefined()
    expect(note).toMatchObject({
      id: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
    expect(snapshot.current.contentItem).toBe(note)
  })

  it('reports known local view-as items without player access as not shared', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)
    const snapshot = createLocalFileSystemSnapshot(scenario.workspace, {
      kind: 'resource',
      resource: createWizardEditorResource(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    })

    expect(snapshot.current.contentItem).toBeNull()
    expect(snapshot.current.availabilityState).toEqual({
      status: 'not_shared',
      label: 'The Lantern Market',
      message: "This item isn't shared with Mira.",
    })
  })

  it('preserves an explicitly requested hidden item for availability resolution', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)
    const navigation = createLocalWorkspaceInitialNavigation(
      scenario.workspace,
      SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
    )
    const snapshot = createLocalFileSystemSnapshot(scenario.workspace, navigation)

    expect(navigation).toEqual({
      kind: 'resource',
      resource: createWizardEditorResource(SAMPLE_LOCAL_RESOURCE_IDS.marketNote),
    })
    expect(snapshot.current.availabilityState).toMatchObject({ status: 'not_shared' })
  })

  it('omits local map pins whose target item is hidden from the viewed player', () => {
    const playerId = testCampaignMemberId('player-hidden-pin')
    const visibleMapId = testResourceId('visible-map')
    const visibleNoteId = testResourceId('visible-note')
    const hiddenNoteId = testResourceId('hidden-note')
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.selectedViewAsPlayerId = playerId
    workspace.items = [
      {
        ...localItemLifecycle(),
        id: visibleMapId,
        parentId: null,
        status: 'active',
        type: 'map',
        title: 'Visible Map',
        description: 'Map pins',
      },
      {
        ...localItemLifecycle(),
        id: visibleNoteId,
        parentId: null,
        status: 'active',
        type: 'note',
        title: 'Visible Note',
        description: 'Session note',
      },
      {
        ...localItemLifecycle(),
        id: hiddenNoteId,
        parentId: null,
        status: 'active',
        type: 'note',
        title: 'Hidden Note',
        description: 'Session note',
      },
    ]
    workspace.noteBodiesById = {
      [hiddenNoteId]: 'Hidden note body',
      [visibleNoteId]: 'Visible note body',
    }
    workspace.mapsById = {
      [visibleMapId]: {
        id: visibleMapId,
        imageUrl: null,
        pins: [
          {
            id: testMapPinId('snapshot_visible_note'),
            itemId: visibleNoteId,
            x: 20,
            y: 25,
            visible: true,
            creationTime: 1000,
          },
          {
            id: testMapPinId('snapshot_hidden_note'),
            itemId: hiddenNoteId,
            x: 40,
            y: 45,
            visible: true,
            creationTime: 1001,
          },
        ],
      },
    }
    workspace.memberItemPermissionsById = {
      [visibleMapId]: { [playerId]: PERMISSION_LEVEL.VIEW },
      [visibleNoteId]: { [playerId]: PERMISSION_LEVEL.VIEW },
    }

    const map = createLocalFileSystemSnapshot(workspace).catalog.getVisibleItemById(
      visibleMapId,
    ) as LocalMapItemWithContent | null

    expect(map?.pins.map((pin) => pin.itemId)).toEqual([visibleNoteId])
    expect(map?.pins[0]?.item?.id).toBe(visibleNoteId)
  })

  it('applies local note visibility rules to every matching block', () => {
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.noteAdditionalBlocksById = {
      [SAMPLE_LOCAL_RESOURCE_IDS.marketNote]: [
        createParagraphBlock('shared-clue-1', 'Shared clue: The ledger has a blue seal.'),
        createParagraphBlock('shared-clue-2', 'Shared clue: The auctioneer knows the buyer.'),
      ],
    }
    workspace.noteBlockVisibilityById = {
      [SAMPLE_LOCAL_RESOURCE_IDS.marketNote]: [
        {
          textIncludes: 'Shared clue:',
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
        },
      ],
    }

    const note = createLocalFileSystemSnapshot(workspace).catalog.getKnownItemById(
      SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
    ) as LocalNoteItemWithContent | null

    expect(note?.blockMeta[testNoteBlockId('shared-clue-1')]).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      shareStatus: SHARE_STATUS.ALL_SHARED,
    })
    expect(note?.blockMeta[testNoteBlockId('shared-clue-2')]).toMatchObject({
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
      shareStatus: SHARE_STATUS.ALL_SHARED,
    })
  })
})

function createParagraphBlock(id: string, text: string): LocalNoteBlock {
  return {
    id: testNoteBlockId(id),
    type: 'paragraph',
    props: {
      textAlignment: 'left',
      textColor: 'default',
      backgroundColor: 'default',
    },
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  }
}

function localItemLifecycle() {
  return {
    createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
    trashedAt: null,
    updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
  }
}
