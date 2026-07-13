import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SHARE_STATUS } from 'shared/block-shares/share-status'
import type { CampaignMemberId, SidebarItemId } from 'shared/common/ids'
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
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import { LOCAL_WORKSPACE_INITIAL_TIMESTAMP } from '../local-workspace-model'
import { testNoteBlockId } from 'shared/test/note-block-id'

type LocalMapItemWithContent = Extract<WizardEditorItemWithContent, { type: 'gameMap' }>
type LocalNoteItemWithContent = Extract<WizardEditorItemWithContent, { type: 'note' }>
type LocalNoteBlock = LocalNoteItemWithContent['content'][number]

afterEach(() => {
  vi.useRealTimers()
})

describe('local filesystem snapshot', () => {
  it('projects stable local item lifecycle timestamps from the workspace model', () => {
    vi.useFakeTimers()
    const createdAt = Date.UTC(2026, 6, 1, 15, 45, 0)
    const updatedAt = Date.UTC(2026, 6, 1, 15, 50, 0)
    const trashedAt = Date.UTC(2026, 6, 1, 15, 55, 0)
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.items = workspace.items.map((item) =>
      item.id === 'note-market'
        ? { ...item, createdAt, status: 'trash', trashedAt, updatedAt }
        : item,
    )
    const noteId = 'note-market' as SidebarItemId

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
    const playerId = 'player-hidden-parent' as CampaignMemberId
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.selectedViewAsPlayerId = playerId
    workspace.items = [
      {
        ...localItemLifecycle(),
        id: 'hidden-folder',
        parentId: null,
        status: 'active',
        type: 'folder',
        title: 'Hidden Folder',
        description: 'Folder',
      },
      {
        ...localItemLifecycle(),
        id: 'visible-note',
        parentId: 'hidden-folder',
        status: 'active',
        type: 'note',
        title: 'Visible Note',
        description: 'Session note',
      },
    ]
    workspace.noteBodiesById = { 'visible-note': 'Visible note body' }
    workspace.memberItemPermissionsById = {
      'visible-note': { [playerId]: PERMISSION_LEVEL.VIEW },
    }

    const snapshot = createLocalFileSystemSnapshot(workspace)
    const noteId = 'visible-note' as SidebarItemId

    expect(snapshot.catalog.getKnownItemById(noteId)?.parentId).toBeNull()
    expect(snapshot.catalog.getVisibleItemById(noteId)?.parentId).toBeNull()
    expect(snapshot.catalog.getVisibleRoots().map((item) => item.id)).toEqual([noteId])
  })

  it('normalizes stale local view-as player ids before projecting the catalog', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const snapshot = createLocalFileSystemSnapshot({
      ...scenario.workspace,
      selectedViewAsPlayerId: 'missing-player' as CampaignMemberId,
    })
    const note = snapshot.catalog.getKnownItemById('note-market' as SidebarItemId)

    expect(snapshot.workspace.selectedViewAsPlayerId).toBeUndefined()
    expect(note).toMatchObject({
      id: 'note-market',
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
    expect(snapshot.current.contentItem).toBe(note)
  })

  it('reports known local view-as items without player access as not shared', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)
    const snapshot = createLocalFileSystemSnapshot(scenario.workspace, {
      kind: 'resource',
      resource: createWizardEditorResource('note-market' as SidebarItemId),
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
    const navigation = createLocalWorkspaceInitialNavigation(scenario.workspace, 'note-market')
    const snapshot = createLocalFileSystemSnapshot(scenario.workspace, navigation)

    expect(navigation).toEqual({
      kind: 'resource',
      resource: createWizardEditorResource('note-market' as SidebarItemId),
    })
    expect(snapshot.current.availabilityState).toMatchObject({ status: 'not_shared' })
  })

  it('omits local map pins whose target item is hidden from the viewed player', () => {
    const playerId = 'player-hidden-pin' as CampaignMemberId
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.selectedViewAsPlayerId = playerId
    workspace.items = [
      {
        ...localItemLifecycle(),
        id: 'visible-map',
        parentId: null,
        status: 'active',
        type: 'map',
        title: 'Visible Map',
        description: 'Map pins',
      },
      {
        ...localItemLifecycle(),
        id: 'visible-note',
        parentId: null,
        status: 'active',
        type: 'note',
        title: 'Visible Note',
        description: 'Session note',
      },
      {
        ...localItemLifecycle(),
        id: 'hidden-note',
        parentId: null,
        status: 'active',
        type: 'note',
        title: 'Hidden Note',
        description: 'Session note',
      },
    ]
    workspace.noteBodiesById = {
      'hidden-note': 'Hidden note body',
      'visible-note': 'Visible note body',
    }
    workspace.mapsById = {
      'visible-map': {
        id: 'visible-map',
        imageUrl: null,
        pins: [
          {
            id: 'pin-visible-note',
            itemId: 'visible-note',
            x: 20,
            y: 25,
            visible: true,
            creationTime: 1000,
          },
          {
            id: 'pin-hidden-note',
            itemId: 'hidden-note',
            x: 40,
            y: 45,
            visible: true,
            creationTime: 1001,
          },
        ],
      },
    }
    workspace.memberItemPermissionsById = {
      'visible-map': { [playerId]: PERMISSION_LEVEL.VIEW },
      'visible-note': { [playerId]: PERMISSION_LEVEL.VIEW },
    }

    const map = createLocalFileSystemSnapshot(workspace).catalog.getVisibleItemById(
      'visible-map' as SidebarItemId,
    ) as LocalMapItemWithContent | null

    expect(map?.pins.map((pin) => pin.itemId)).toEqual(['visible-note'])
    expect(map?.pins[0]?.item?.id).toBe('visible-note')
  })

  it('applies local note visibility rules to every matching block', () => {
    const workspace = structuredClone(SAMPLE_LOCAL_WORKSPACE)
    workspace.noteAdditionalBlocksById = {
      'note-market': [
        createParagraphBlock('shared-clue-1', 'Shared clue: The ledger has a blue seal.'),
        createParagraphBlock('shared-clue-2', 'Shared clue: The auctioneer knows the buyer.'),
      ],
    }
    workspace.noteBlockVisibilityById = {
      'note-market': [
        {
          textIncludes: 'Shared clue:',
          myPermissionLevel: PERMISSION_LEVEL.VIEW,
          shareStatus: SHARE_STATUS.ALL_SHARED,
        },
      ],
    }

    const note = createLocalFileSystemSnapshot(workspace).catalog.getKnownItemById(
      'note-market' as SidebarItemId,
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
