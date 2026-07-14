import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceState } from './local-workspace-model'
import {
  LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
  createLocalTextFilePayload,
} from './local-workspace-model'
import type { UserProfileId } from 'shared/common/ids'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

const SAMPLE_MARKET_PIN_ID = assertDomainId(
  DOMAIN_ID_KIND.mapPin,
  '01980c1a-5e70-7000-8000-000000000101',
)
const SAMPLE_HANDOUT_PIN_ID = assertDomainId(
  DOMAIN_ID_KIND.mapPin,
  '01980c1a-5e70-7000-8000-000000000102',
)
const SAMPLE_BRIEF_NODE_ID = assertDomainId(
  DOMAIN_ID_KIND.canvasNode,
  '01980c1a-5e70-7000-8000-000000000201',
)
const SAMPLE_MAP_NODE_ID = assertDomainId(
  DOMAIN_ID_KIND.canvasNode,
  '01980c1a-5e70-7000-8000-000000000202',
)
const SAMPLE_CLOCK_NODE_ID = assertDomainId(
  DOMAIN_ID_KIND.canvasNode,
  '01980c1a-5e70-7000-8000-000000000203',
)

const INITIAL_NOTE_BODY = [
  'A waterfront bazaar where every stall hides a second ledger.',
  '',
  '- Ask Mara about the blue-glass shipment.',
  '- The bell tower guard changes posts after the third tide bell.',
  '- Players know the public auction starts at dusk.',
].join('\n')

const SAMPLE_TIMESTAMP = 1704067200000
type SampleCanvasPayload = LocalWorkspaceState['canvasPayloadsById'][string]
const INITIAL_MAP_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#16202a"/>
  <rect x="92" y="118" width="305" height="112" rx="18" fill="#2f6f73"/>
  <rect x="456" y="96" width="232" height="148" rx="18" fill="#7a5b38"/>
  <rect x="760" y="132" width="300" height="124" rx="18" fill="#5b4f83"/>
  <path d="M0 455 C180 390 318 505 496 442 C708 366 883 474 1200 388 L1200 760 L0 760 Z" fill="#255b7a"/>
  <path d="M90 312 L1054 312" stroke="#d6b36b" stroke-width="16" stroke-linecap="round" opacity="0.85"/>
  <path d="M184 312 L184 574 M348 312 L348 612 M636 312 L636 548 M920 312 L920 602" stroke="#c0904f" stroke-width="20" stroke-linecap="round"/>
  <circle cx="184" cy="574" r="24" fill="#d6b36b"/>
  <circle cx="348" cy="612" r="24" fill="#d6b36b"/>
  <circle cx="636" cy="548" r="24" fill="#d6b36b"/>
  <circle cx="920" cy="602" r="24" fill="#d6b36b"/>
  <text x="92" y="72" fill="#f3ead7" font-family="serif" font-size="42">Moonwell Docks</text>
  <text x="112" y="192" fill="#f3ead7" font-family="sans-serif" font-size="28">Lantern Market</text>
  <text x="480" y="176" fill="#f3ead7" font-family="sans-serif" font-size="28">Salt Warehouse</text>
  <text x="790" y="210" fill="#f3ead7" font-family="sans-serif" font-size="28">Bell Tower</text>
</svg>
`)}`

export const SAMPLE_LOCAL_WORKSPACE: LocalWorkspaceState = {
  localUser: {
    color: '#61afef',
    id: 'demo-user' as UserProfileId,
    name: 'Demo',
  },
  workspaceId: 'demo-campaign',
  nextLocalItemIndex: 2,
  items: [
    {
      createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      id: 'note-market',
      parentId: null,
      status: 'active',
      trashedAt: null,
      type: 'note',
      updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      title: 'The Lantern Market',
      description: 'Session note',
    },
    {
      createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      id: 'canvas-heist',
      parentId: null,
      status: 'active',
      trashedAt: null,
      type: 'canvas',
      updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      title: 'Harbor Heist Board',
      description: 'Canvas',
    },
    {
      createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      id: 'map-docks',
      parentId: null,
      status: 'active',
      trashedAt: null,
      type: 'map',
      updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      title: 'Moonwell Docks',
      description: 'Map pins',
    },
    {
      createdAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      id: 'file-handout',
      parentId: null,
      status: 'active',
      trashedAt: null,
      type: 'file',
      updatedAt: LOCAL_WORKSPACE_INITIAL_TIMESTAMP,
      title: 'Blue-glass Invoice',
      description: 'Handout',
    },
  ],
  noteAdditionalBlocksById: {},
  noteBodiesById: { 'note-market': INITIAL_NOTE_BODY },
  canvasPayloadsById: {
    'canvas-heist': {
      nodes: createInitialCanvasNodes(),
      edges: createInitialCanvasEdges(),
    },
  },
  filePayloadsById: {
    'file-handout': createLocalTextFilePayload({
      name: 'blue-glass-invoice.txt',
      contentType: 'text/plain',
      body: [
        'Blue-glass shipment invoice',
        '',
        'Docking fee paid by Mara Vell.',
        'Two crates redirected to the Salt Warehouse.',
        'A third signature has been scratched out.',
      ].join('\n'),
    }),
  },
  mapsById: {
    'map-docks': {
      id: 'map-docks',
      imageUrl: INITIAL_MAP_IMAGE_URL,
      pins: [
        {
          id: SAMPLE_MARKET_PIN_ID,
          itemId: 'note-market',
          x: 20,
          y: 25,
          visible: true,
          creationTime: SAMPLE_TIMESTAMP,
        },
        {
          id: SAMPLE_HANDOUT_PIN_ID,
          itemId: 'file-handout',
          x: 53,
          y: 23,
          visible: true,
          creationTime: SAMPLE_TIMESTAMP,
        },
      ],
    },
  },
}

function createInitialCanvasNodes(): SampleCanvasPayload['nodes'] {
  return [
    {
      id: SAMPLE_BRIEF_NODE_ID,
      type: 'text',
      position: { x: 40, y: 40 },
      width: 320,
      height: 144,
      data: {
        content: [
          {
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'Session brief', styles: { bold: true } }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Connect locations, NPC notes, and the next reveal before play starts.',
              },
            ],
          },
        ],
        backgroundColor: 'var(--t-blue)',
        backgroundOpacity: 0.16,
        borderStroke: 'var(--t-blue)',
        borderOpacity: 0.5,
        borderWidth: 2,
      },
    },
    {
      id: SAMPLE_MAP_NODE_ID,
      type: 'embed',
      position: { x: 480, y: 56 },
      width: 300,
      height: 210,
      data: {
        target: { kind: 'resource', resourceId: 'map-docks' as ResourceId },
        textColor: 'var(--foreground)',
        backgroundColor: 'var(--t-green)',
        backgroundOpacity: 0.12,
        borderStroke: 'var(--t-green)',
        borderOpacity: 0.5,
        borderWidth: 2,
      },
    },
    {
      id: SAMPLE_CLOCK_NODE_ID,
      type: 'text',
      position: { x: 180, y: 310 },
      width: 300,
      height: 128,
      data: {
        content: [
          {
            type: 'heading',
            props: { level: 4 },
            content: [{ type: 'text', text: 'Encounter clock' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Guards alerted: 2 of 4 segments.' }],
          },
        ],
        backgroundColor: 'var(--t-orange)',
        backgroundOpacity: 0.18,
        borderStroke: 'var(--t-orange)',
        borderOpacity: 0.55,
        borderWidth: 2,
      },
    },
  ]
}

function createInitialCanvasEdges(): SampleCanvasPayload['edges'] {
  return [
    {
      id: 'brief-to-map',
      source: SAMPLE_BRIEF_NODE_ID,
      target: SAMPLE_MAP_NODE_ID,
      type: 'bezier',
      sourceHandle: null,
      targetHandle: null,
      style: { stroke: 'var(--t-blue)', strokeWidth: 2, opacity: 0.65 },
    },
    {
      id: 'brief-to-clock',
      source: SAMPLE_BRIEF_NODE_ID,
      target: SAMPLE_CLOCK_NODE_ID,
      type: 'step',
      sourceHandle: null,
      targetHandle: null,
      style: { stroke: 'var(--t-orange)', strokeWidth: 2, opacity: 0.7 },
    },
  ]
}
