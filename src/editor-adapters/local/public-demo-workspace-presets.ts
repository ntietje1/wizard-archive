import type { WizardEditorNoteCollaborationPlayback } from '@wizard-archive/editor/adapter'
import type { LocalWorkspaceState } from './local-workspace-model'
import {
  LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
  createLocalTextFilePayload,
} from './local-workspace-model'
import { SAMPLE_LOCAL_RESOURCE_IDS, SAMPLE_LOCAL_WORKSPACE } from './sample-local-workspace'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SHARE_STATUS } from 'shared/block-shares/share-status'
import { assertUsername } from 'shared/users/validation'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignMemberId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import {
  assertSha256Digest,
  initialVersion,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'

const PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID = SAMPLE_LOCAL_RESOURCE_IDS.marketNote
type PublicDemoAdditionalBlock = LocalWorkspaceState['noteAdditionalBlocksById'][string][number]
const PUBLIC_DEMO_SESSION_NOTE_ID = assertDomainId(
  DOMAIN_ID_KIND.resource,
  '01980c1a-5e70-7000-8000-000000000405',
)
const PUBLIC_DEMO_SESSION_REVEAL_EMBED_BLOCK_ID = assertDomainId(
  DOMAIN_ID_KIND.noteBlock,
  '01980c1a-5e70-7000-8000-000000000001',
)
const PUBLIC_DEMO_LAYERED_MAP_ID = SAMPLE_LOCAL_RESOURCE_IDS.docksMap
const PUBLIC_DEMO_MAP_LAYER_1_ID = 'map-docks-layer-1'
const PUBLIC_DEMO_MAP_LAYER_2_ID = 'map-docks-layer-2'
const PUBLIC_DEMO_MAP_VISIBLE_GHOST_ITEM_ID = SAMPLE_LOCAL_RESOURCE_IDS.marketNote
const PUBLIC_DEMO_MAP_VISIBLE_PLAYER_ITEM_ID = SAMPLE_LOCAL_RESOURCE_IDS.invoiceFile
const PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID = assertDomainId(
  DOMAIN_ID_KIND.resource,
  '01980c1a-5e70-7000-8000-000000000406',
)
const PUBLIC_DEMO_MAP_HIDDEN_PIN_ITEM_ID = SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas
const PUBLIC_DEMO_MAP_HIDDEN_PIN_ID = assertDomainId(
  DOMAIN_ID_KIND.mapPin,
  '01980c1a-5e70-7000-8000-000000000103',
)
const PUBLIC_DEMO_MAP_LAYER_2_PIN_ID = assertDomainId(
  DOMAIN_ID_KIND.mapPin,
  '01980c1a-5e70-7000-8000-000000000104',
)
const PUBLIC_DEMO_PRIVATE_PREP_PLAYER_TEXT = 'Players know the public auction starts at dusk.'
const PUBLIC_DEMO_PRIVATE_PREP_SECRET_TEXT =
  'GM secret: Mara Vell planted the blue-glass invoice to bait the Salt Warehouse clerk.'
const PUBLIC_DEMO_PRIVATE_PREP_NOTE_BODY = [
  'Prep for the Lantern Market reveal.',
  '',
  `- ${PUBLIC_DEMO_PRIVATE_PREP_PLAYER_TEXT}`,
  `- ${PUBLIC_DEMO_PRIVATE_PREP_SECRET_TEXT}`,
  '- The clue connects the [[The Lantern Market]] to the [[Harbor Heist Board]], but the courier vanishes before the party reaches [[Moonwell Docks]].',
].join('\n')
const PUBLIC_DEMO_PLAYER_MEMBER_ID = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01980c1a-5e70-7000-8000-000000000105',
)
const PUBLIC_DEMO_PLAYER_USER_ID = assertDomainId(
  DOMAIN_ID_KIND.userProfile,
  '01980c1a-5e70-7000-8000-000000000302',
)
const PUBLIC_DEMO_PLAYER_MEMBERS: Array<CampaignMemberSummary> = [
  {
    id: PUBLIC_DEMO_PLAYER_MEMBER_ID,
    createdAt: 1,
    campaignId: SAMPLE_LOCAL_WORKSPACE.workspaceId,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Accepted,
    userId: PUBLIC_DEMO_PLAYER_USER_ID,
    userProfile: {
      imageUrl: null,
      name: 'Mira',
      username: assertUsername('mira'),
    },
  },
]

const PUBLIC_DEMO_COLLABORATION_NOTE_ID = PUBLIC_DEMO_SESSION_NOTE_ID
const PUBLIC_DEMO_COLLABORATION_TYPING_TEXT =
  'Jun adds: The tide bell rings twice before the courier arrives.'
const PUBLIC_DEMO_COLLABORATION_INITIAL_TYPING_STEP = 18
const PUBLIC_DEMO_COLLABORATION_TYPING_BLOCK_INDEX = 4
const PUBLIC_DEMO_COLLABORATION_PLAYBACK = {
  collaborators: [
    {
      name: 'Mara',
      color: '#2563eb',
    },
    {
      name: 'Priya',
      color: '#16a34a',
    },
    {
      name: 'Jun',
      color: '#db2777',
    },
  ],
  initialTypingStep: PUBLIC_DEMO_COLLABORATION_INITIAL_TYPING_STEP,
  noteId: PUBLIC_DEMO_COLLABORATION_NOTE_ID,
  typingBlockIndex: PUBLIC_DEMO_COLLABORATION_TYPING_BLOCK_INDEX,
  typingText: PUBLIC_DEMO_COLLABORATION_TYPING_TEXT,
} as const satisfies WizardEditorNoteCollaborationPlayback
const PUBLIC_DEMO_TEMPLATE_NOTE_ID = SAMPLE_LOCAL_RESOURCE_IDS.marketNote
const PUBLIC_DEMO_MAP_LAYER_2_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#1e2430"/>
  <path d="M126 172 C316 108 494 152 646 124 C814 92 970 134 1090 98" fill="none" stroke="#65758f" stroke-width="26" stroke-linecap="round"/>
  <path d="M112 566 C276 468 434 540 584 468 C754 386 908 450 1098 338" fill="none" stroke="#3d88a4" stroke-width="58" stroke-linecap="round"/>
  <path d="M248 192 L316 560 M620 142 L604 454 M936 132 L1002 366" stroke="#c7b27a" stroke-width="18" stroke-linecap="round" opacity="0.85"/>
  <circle cx="316" cy="560" r="26" fill="#c7b27a"/>
  <circle cx="604" cy="454" r="26" fill="#c7b27a"/>
  <circle cx="1002" cy="366" r="26" fill="#c7b27a"/>
  <text x="92" y="76" fill="#f3ead7" font-family="serif" font-size="42">Moonwell Docks</text>
  <text x="112" y="132" fill="#c9d8e8" font-family="sans-serif" font-size="24">Tide tunnels</text>
  <text x="360" y="594" fill="#f3ead7" font-family="sans-serif" font-size="26">Old culvert</text>
  <text x="646" y="432" fill="#f3ead7" font-family="sans-serif" font-size="26">Moonwell intake</text>
  <text x="790" y="326" fill="#f3ead7" font-family="sans-serif" font-size="26">Smugglers' lift</text>
</svg>
`)}`

export const PUBLIC_DEMO_SCENARIO_IDS = {
  campaignHome: 'campaign-home',
  campaignTemplate: 'campaign-template',
  collaborativeSessionNotes: 'collaborative-session-notes',
  connectedCanvas: 'connected-canvas',
  layeredLoreMap: 'layered-lore-map',
  playerPreview: 'player-preview',
  privatePrep: 'private-prep',
  revealReady: 'reveal-ready',
  revealedInPlay: 'revealed-in-play',
} as const

export type PublicDemoScenarioId =
  (typeof PUBLIC_DEMO_SCENARIO_IDS)[keyof typeof PUBLIC_DEMO_SCENARIO_IDS]

export interface PublicDemoScenario {
  collaborationPlayback?: WizardEditorNoteCollaborationPlayback
  id: PublicDemoScenarioId
  initialItemId: ResourceId | null
  workspace: LocalWorkspaceState
}

const PUBLIC_DEMO_COLLABORATION_NOTE_BASE = [
  'Scene: Moonwell Docks',
  '',
  '- Mara is watching the customs office.',
  '- Priya is tagging clues the players already know.',
  '- Selene is drafting the next reveal from the invoice.',
  PUBLIC_DEMO_COLLABORATION_TYPING_TEXT.slice(0, PUBLIC_DEMO_COLLABORATION_INITIAL_TYPING_STEP),
].join('\n')

const PUBLIC_DEMO_TEMPLATE_NOTE_BODY = [
  'Location Format: Moonwell Docks',
  '',
  '- Purpose: recurring contact point for smuggling clues.',
  '- First impression: wet stone, lantern fog, tide bells.',
  '- Secrets: hidden invoice cache, customs office ledger, Mara Vell contact.',
  '- Scenes to prep: arrival, chase, quiet negotiation, reveal.',
].join('\n')

function createPublicDemoLinkPreviewWorkspace(): LocalWorkspaceState {
  return createWorkspaceWithNoteBody(
    PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
    PUBLIC_DEMO_PRIVATE_PREP_NOTE_BODY,
  )
}

function createPublicDemoPlayerPreviewWorkspace(): LocalWorkspaceState {
  return withPublicDemoPrivatePrepSharingState(createPublicDemoLinkPreviewWorkspace(), {
    selectedViewAsPlayerId: PUBLIC_DEMO_PLAYER_MEMBER_ID,
  })
}

function createPublicDemoRevealedInPlayWorkspace(): LocalWorkspaceState {
  return withPublicDemoPrivatePrepSharingState(createPublicDemoLinkPreviewWorkspace(), {
    selectedViewAsPlayerId: PUBLIC_DEMO_PLAYER_MEMBER_ID,
    secretVisibleToPlayer: true,
  })
}

function createPublicDemoCollaborationWorkspace(): LocalWorkspaceState {
  const workspace = createWorkspaceWithNoteBody(
    PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
    PUBLIC_DEMO_PRIVATE_PREP_NOTE_BODY,
  )

  return withPublicDemoPrivatePrepSharingState(
    {
      ...workspace,
      items: [
        {
          createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
          id: PUBLIC_DEMO_SESSION_NOTE_ID,
          metadataVersion: initialVersion(
            assertSha256Digest('63ce6f735d05671271e4d0e42b5dab5cf05fc7990b4d7dfbf534861ade291d44'),
          ),
          parentId: null,
          status: 'active',
          trashedAt: null,
          type: 'note',
          updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
          title: 'Session Notes',
          description: 'Collaborative session notes',
        },
        ...workspace.items,
      ],
      noteAdditionalBlocksById: {
        ...workspace.noteAdditionalBlocksById,
        [PUBLIC_DEMO_SESSION_NOTE_ID]: [
          createResourceEmbedBlock({
            blockId: PUBLIC_DEMO_SESSION_REVEAL_EMBED_BLOCK_ID,
            resourceId: PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
          }),
        ],
      },
      noteBodiesById: {
        ...workspace.noteBodiesById,
        [PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID]: PUBLIC_DEMO_PRIVATE_PREP_NOTE_BODY,
        [PUBLIC_DEMO_SESSION_NOTE_ID]: PUBLIC_DEMO_COLLABORATION_NOTE_BASE,
      },
    },
    {
      secretVisibleToPlayer: true,
      playerVisibleItemIds: [PUBLIC_DEMO_SESSION_NOTE_ID],
      selectedViewAsPlayerId: PUBLIC_DEMO_PLAYER_MEMBER_ID,
    },
  )
}

function createPublicDemoLayeredLoreMapWorkspace(): LocalWorkspaceState {
  const workspace = clonePublicDemoWorkspace()
  const baseMap = workspace.mapsById[PUBLIC_DEMO_LAYERED_MAP_ID]
  if (!baseMap) {
    throw new Error(`Public demo map preset references missing map "${PUBLIC_DEMO_LAYERED_MAP_ID}"`)
  }
  const mapPinCreationTime = baseMap.pins[0]?.creationTime ?? 1

  return {
    ...workspace,
    items: [
      ...workspace.items,
      {
        createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
        id: PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID,
        metadataVersion: initialVersion(
          assertSha256Digest('3ebdd69720bde04f41bba5edc41cc5618599de86b8c43c70724f0b650425144b'),
        ),
        parentId: null,
        status: 'active',
        trashedAt: null,
        type: 'file',
        updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
        title: 'Tide Tunnel Sketch',
        description: 'Handout',
      },
    ],
    filePayloadsById: {
      ...workspace.filePayloadsById,
      [PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID]: createLocalTextFilePayload({
        name: 'tide-tunnel-sketch.txt',
        contentType: 'text/plain',
        body: [
          'Tide tunnel sketch',
          '',
          'A hand-drawn route from the old culvert to the smugglers lift below the docks.',
          'The moonwell intake floods on the third bell.',
        ].join('\n'),
      }),
    },
    mapsById: {
      ...workspace.mapsById,
      [PUBLIC_DEMO_LAYERED_MAP_ID]: {
        ...baseMap,
        layers: [
          {
            id: PUBLIC_DEMO_MAP_LAYER_1_ID,
            imageUrl: baseMap.imageUrl,
            name: 'Layer 1',
          },
          {
            id: PUBLIC_DEMO_MAP_LAYER_2_ID,
            imageUrl: PUBLIC_DEMO_MAP_LAYER_2_IMAGE_URL,
            name: 'Layer 2',
          },
        ],
        pins: [
          ...baseMap.pins.map((pin) => ({ ...pin, layerId: PUBLIC_DEMO_MAP_LAYER_1_ID })),
          {
            id: PUBLIC_DEMO_MAP_HIDDEN_PIN_ID,
            itemId: PUBLIC_DEMO_MAP_HIDDEN_PIN_ITEM_ID,
            layerId: PUBLIC_DEMO_MAP_LAYER_2_ID,
            x: 78,
            y: 32,
            visible: false,
            creationTime: mapPinCreationTime,
          },
          {
            id: PUBLIC_DEMO_MAP_LAYER_2_PIN_ID,
            itemId: PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID,
            layerId: PUBLIC_DEMO_MAP_LAYER_2_ID,
            x: 84,
            y: 43,
            visible: true,
            creationTime: mapPinCreationTime,
          },
        ],
      },
    },
    memberItemPermissionsById: {
      ...workspace.memberItemPermissionsById,
      [PUBLIC_DEMO_LAYERED_MAP_ID]: {
        ...workspace.memberItemPermissionsById?.[PUBLIC_DEMO_LAYERED_MAP_ID],
        [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.VIEW,
      },
      [PUBLIC_DEMO_MAP_VISIBLE_GHOST_ITEM_ID]: {
        ...workspace.memberItemPermissionsById?.[PUBLIC_DEMO_MAP_VISIBLE_GHOST_ITEM_ID],
        [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.NONE,
      },
      [PUBLIC_DEMO_MAP_VISIBLE_PLAYER_ITEM_ID]: {
        ...workspace.memberItemPermissionsById?.[PUBLIC_DEMO_MAP_VISIBLE_PLAYER_ITEM_ID],
        [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.VIEW,
      },
      [PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID]: {
        ...workspace.memberItemPermissionsById?.[PUBLIC_DEMO_MAP_LAYER_2_VISIBLE_ITEM_ID],
        [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.VIEW,
      },
      [PUBLIC_DEMO_MAP_HIDDEN_PIN_ITEM_ID]: {
        ...workspace.memberItemPermissionsById?.[PUBLIC_DEMO_MAP_HIDDEN_PIN_ITEM_ID],
        [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.VIEW,
      },
    },
    playerMembers: clonePublicDemoPlayerMembers(),
    selectedViewAsPlayerId: PUBLIC_DEMO_PLAYER_MEMBER_ID,
  }
}

function createPublicDemoTemplateWorkspace(): LocalWorkspaceState {
  return createWorkspaceWithNoteBody(PUBLIC_DEMO_TEMPLATE_NOTE_ID, PUBLIC_DEMO_TEMPLATE_NOTE_BODY, {
    description: 'Reusable note format',
    metadataVersion: initialVersion(
      assertSha256Digest('bea5322e4057c31aea55a0277829648cc826eec6a8a9bc997c27dde1b45b602c'),
    ),
    title: 'Location Template',
  })
}

export function createPublicDemoScenario(id: PublicDemoScenarioId): PublicDemoScenario {
  switch (id) {
    case PUBLIC_DEMO_SCENARIO_IDS.campaignHome:
      return createPublicDemoScenarioState(id, clonePublicDemoWorkspace())
    case PUBLIC_DEMO_SCENARIO_IDS.privatePrep:
      return createPublicDemoScenarioState(
        id,
        withPublicDemoPrivatePrepSharingState(createPublicDemoLinkPreviewWorkspace()),
      )
    case PUBLIC_DEMO_SCENARIO_IDS.playerPreview:
      return createPublicDemoScenarioState(id, createPublicDemoPlayerPreviewWorkspace(), {
        initialItemId: PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
      })
    case PUBLIC_DEMO_SCENARIO_IDS.revealReady:
      return createPublicDemoScenarioState(id, createPublicDemoPlayerPreviewWorkspace(), {
        initialItemId: PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
      })
    case PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay:
      return createPublicDemoScenarioState(id, createPublicDemoRevealedInPlayWorkspace(), {
        initialItemId: PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
      })
    case PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes:
      return createPublicDemoScenarioState(id, createPublicDemoCollaborationWorkspace(), {
        collaborationPlayback: PUBLIC_DEMO_COLLABORATION_PLAYBACK,
        initialItemId: PUBLIC_DEMO_SESSION_NOTE_ID,
      })
    case PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas:
      return createPublicDemoScenarioState(id, clonePublicDemoWorkspace(), {
        initialItemId: findPublicDemoCanvasId(),
      })
    case PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap:
      return createPublicDemoScenarioState(id, createPublicDemoLayeredLoreMapWorkspace(), {
        initialItemId: findPublicDemoMapId(),
      })
    case PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate:
      return createPublicDemoScenarioState(id, createPublicDemoTemplateWorkspace())
    default:
      return throwUnsupportedPublicDemoScenario(id)
  }
}

function throwUnsupportedPublicDemoScenario(id: never): never {
  const scenarioId = String(id)
  throw new Error(`Unsupported public demo scenario "${scenarioId}"`)
}

function createPublicDemoScenarioState(
  id: PublicDemoScenarioId,
  workspace: LocalWorkspaceState,
  options: {
    collaborationPlayback?: WizardEditorNoteCollaborationPlayback
    initialItemId?: ResourceId | null
  } = {},
): PublicDemoScenario {
  return {
    id,
    workspace,
    ...(options.collaborationPlayback
      ? {
          collaborationPlayback: clonePublicDemoCollaborationPlayback(
            options.collaborationPlayback,
          ),
        }
      : {}),
    initialItemId: options.initialItemId ?? null,
  }
}

function createWorkspaceWithNoteBody(
  noteId: string,
  body: string,
  metadata?:
    | { description?: string; metadataVersion?: undefined; title?: undefined }
    | { description?: string; metadataVersion: VersionStamp; title: string },
): LocalWorkspaceState {
  assertPublicDemoNoteItem(noteId)
  const workspace = clonePublicDemoWorkspace()

  const items = metadata
    ? workspace.items.map((item) =>
        item.id === noteId
          ? {
              ...item,
              ...(metadata.description ? { description: metadata.description } : {}),
              ...(metadata.metadataVersion ? { metadataVersion: metadata.metadataVersion } : {}),
              ...(metadata.title ? { title: metadata.title } : {}),
            }
          : item,
      )
    : workspace.items

  return {
    ...workspace,
    items,
    noteBodiesById: {
      ...workspace.noteBodiesById,
      [noteId]: body,
    },
  }
}

function createResourceEmbedBlock({
  blockId,
  resourceId,
}: {
  blockId: NoteBlockId
  resourceId: string
}): PublicDemoAdditionalBlock {
  return {
    id: blockId,
    type: 'embed',
    props: {
      targetKind: 'resource',
      resourceId,
      previewWidth: 560,
    },
    content: undefined,
    children: [],
  }
}

function assertPublicDemoNoteItem(noteId: string) {
  const item = SAMPLE_LOCAL_WORKSPACE.items.find((candidate) => candidate.id === noteId)
  if (item?.type === 'note') return
  throw new Error(`Public demo note preset references missing note "${noteId}"`)
}

function withPublicDemoPrivatePrepSharingState(
  workspace: LocalWorkspaceState,
  options: {
    playerVisibleItemIds?: Array<string>
    secretVisibleToPlayer?: boolean
    selectedViewAsPlayerId?: CampaignMemberId
  } = {},
): LocalWorkspaceState {
  const memberItemPermissionsById = { ...workspace.memberItemPermissionsById }
  for (const itemId of [
    PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID,
    ...(options.playerVisibleItemIds ?? []),
  ]) {
    memberItemPermissionsById[itemId] = {
      ...memberItemPermissionsById[itemId],
      [PUBLIC_DEMO_PLAYER_MEMBER_ID]: PERMISSION_LEVEL.VIEW,
    }
  }

  return {
    ...workspace,
    memberItemPermissionsById,
    noteBlockVisibilityById: {
      ...workspace.noteBlockVisibilityById,
      [PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID]: [
        ...(workspace.noteBlockVisibilityById?.[PUBLIC_DEMO_LINK_PREVIEW_NOTE_ID] ?? []),
        {
          textIncludes: PUBLIC_DEMO_PRIVATE_PREP_PLAYER_TEXT,
          shareStatus: SHARE_STATUS.ALL_SHARED,
        },
        createPublicDemoPrivatePrepSecretVisibilityRule(options.secretVisibleToPlayer ?? false),
      ],
    },
    playerMembers: clonePublicDemoPlayerMembers(),
    ...(options.selectedViewAsPlayerId
      ? { selectedViewAsPlayerId: options.selectedViewAsPlayerId }
      : {}),
  }
}

function clonePublicDemoWorkspace(): LocalWorkspaceState {
  return structuredClone(SAMPLE_LOCAL_WORKSPACE) as LocalWorkspaceState
}

function clonePublicDemoPlayerMembers(): Array<CampaignMemberSummary> {
  return structuredClone(PUBLIC_DEMO_PLAYER_MEMBERS) as Array<CampaignMemberSummary>
}

function clonePublicDemoCollaborationPlayback(
  playback: WizardEditorNoteCollaborationPlayback,
): WizardEditorNoteCollaborationPlayback {
  return structuredClone(playback) as WizardEditorNoteCollaborationPlayback
}

function createPublicDemoPrivatePrepSecretVisibilityRule(secretVisibleToPlayer: boolean) {
  if (secretVisibleToPlayer) {
    return {
      textIncludes: PUBLIC_DEMO_PRIVATE_PREP_SECRET_TEXT,
      shareStatus: SHARE_STATUS.ALL_SHARED,
    }
  }

  return {
    textIncludes: PUBLIC_DEMO_PRIVATE_PREP_SECRET_TEXT,
    shareStatus: SHARE_STATUS.NOT_SHARED,
    hiddenFrom: [PUBLIC_DEMO_PLAYER_MEMBER_ID],
  }
}

function findPublicDemoCanvasId() {
  return SAMPLE_LOCAL_WORKSPACE.items.find((item) => item.type === 'canvas')?.id ?? null
}

function findPublicDemoMapId() {
  return SAMPLE_LOCAL_WORKSPACE.items.find((item) => item.type === 'map')?.id ?? null
}
