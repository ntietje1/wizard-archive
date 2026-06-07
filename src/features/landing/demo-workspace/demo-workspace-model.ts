import type { CustomBlock } from 'shared/editor-blocks/types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import { assertNever } from '~/shared/utils/utils'

export type DemoWorkspaceItemType = 'note' | 'canvas' | 'map' | 'file'

export interface DemoWorkspaceItem {
  id: string
  type: DemoWorkspaceItemType
  title: string
  description: string
}

export interface DemoMapPin {
  id: string
  label: string
  detail: string
  x: number
  y: number
  visibleToPlayers: boolean
}

interface DemoWorkspaceState {
  campaignName: string
  mountedItemIds: Array<string>
  resetToken: number
  selectedItemId: string
  items: Array<DemoWorkspaceItem>
  note: {
    id: string
    title: string
    body: string
  }
  canvas: {
    id: string
    nodes: Array<CanvasDocumentNode>
    edges: Array<CanvasDocumentEdge>
  }
  map: {
    id: string
    pins: Array<DemoMapPin>
  }
  file: {
    id: string
    name: string
    contentType: string
    body: string
  }
}

type DemoWorkspaceAction =
  | { type: 'selectItem'; itemId: string }
  | { type: 'renameSelectedItem'; title: string }
  | { type: 'reset' }

export const INITIAL_DEMO_WORKSPACE = createInitialDemoWorkspace()

function createInitialDemoWorkspace(resetToken = 0): DemoWorkspaceState {
  return {
    campaignName: 'Lanterns of Brindlehook',
    mountedItemIds: ['note-market'],
    resetToken,
    selectedItemId: 'note-market',
    items: [
      {
        id: 'note-market',
        type: 'note',
        title: 'The Lantern Market',
        description: 'Session note',
      },
      {
        id: 'canvas-heist',
        type: 'canvas',
        title: 'Harbor Heist Board',
        description: 'Canvas',
      },
      {
        id: 'map-docks',
        type: 'map',
        title: 'Moonwell Docks',
        description: 'Map pins',
      },
      {
        id: 'file-handout',
        type: 'file',
        title: 'Blue-glass Invoice',
        description: 'Handout',
      },
    ],
    note: {
      id: 'note-market',
      title: 'The Lantern Market',
      body: [
        'A waterfront bazaar where every stall hides a second ledger.',
        '',
        '- Ask Mara about the blue-glass shipment.',
        '- The bell tower guard changes posts after the third tide bell.',
        '- Players know the public auction starts at dusk.',
      ].join('\n'),
    },
    canvas: {
      id: 'canvas-heist',
      nodes: createInitialCanvasNodes(),
      edges: createInitialCanvasEdges(),
    },
    map: {
      id: 'map-docks',
      pins: [
        {
          id: 'pin-warehouse',
          label: 'Salt warehouse',
          detail: 'Locked office and false floor.',
          x: 28,
          y: 42,
          visibleToPlayers: false,
        },
        {
          id: 'pin-pier',
          label: 'Blue pier',
          detail: 'Meeting spot after the auction.',
          x: 63,
          y: 58,
          visibleToPlayers: true,
        },
      ],
    },
    file: {
      id: 'file-handout',
      name: 'blue-glass-invoice.txt',
      contentType: 'text/plain',
      body: [
        'Blue-glass shipment invoice',
        '',
        'Docking fee paid by Mara Vell.',
        'Two crates redirected to the Salt Warehouse.',
        'A third signature has been scratched out.',
      ].join('\n'),
    },
  }
}

export function demoWorkspaceReducer(
  state: DemoWorkspaceState,
  action: DemoWorkspaceAction,
): DemoWorkspaceState {
  switch (action.type) {
    case 'selectItem':
      if (!state.items.some((item) => item.id === action.itemId)) return state
      return {
        ...state,
        selectedItemId: action.itemId,
        mountedItemIds: state.mountedItemIds.includes(action.itemId)
          ? state.mountedItemIds
          : [...state.mountedItemIds, action.itemId],
      }
    case 'renameSelectedItem':
      return renameSelectedItem(state, action.title)
    case 'reset':
      return createInitialDemoWorkspace(state.resetToken + 1)
    default:
      return assertNever(action)
  }
}

export function selectedDemoItem(state: DemoWorkspaceState) {
  return state.items.find((item) => item.id === state.selectedItemId) ?? state.items[0]
}

export function noteBodyToBlocks(body: string): Array<CustomBlock> {
  const lines = body.split('\n')
  const blocks: Array<CustomBlock> = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return

    if (trimmed.startsWith('- ')) {
      blocks.push({
        id: `demo-note-list-${index}`,
        type: 'bulletListItem',
        props: {},
        content: [{ type: 'text', text: trimmed.slice(2), styles: {} }],
        children: [],
      })
      return
    }

    blocks.push({
      id: `demo-note-paragraph-${index}`,
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: trimmed, styles: {} }],
      children: [],
    })
  })

  return blocks
}

function renameSelectedItem(state: DemoWorkspaceState, title: string): DemoWorkspaceState {
  const nextTitle = title.trimStart()
  const item = selectedDemoItem(state)
  const items = state.items.map((candidate) =>
    candidate.id === item.id ? { ...candidate, title: nextTitle } : candidate,
  )

  if (item.type === 'note') return { ...state, items, note: { ...state.note, title: nextTitle } }
  return { ...state, items }
}

function createInitialCanvasNodes(): Array<CanvasDocumentNode> {
  return [
    {
      id: 'scene-brief',
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
      id: 'market-map',
      type: 'embed',
      position: { x: 480, y: 56 },
      width: 300,
      height: 210,
      data: {
        sidebarItemId: 'map-docks',
        textColor: 'var(--foreground)',
        backgroundColor: 'var(--t-green)',
        backgroundOpacity: 0.12,
        borderStroke: 'var(--t-green)',
        borderOpacity: 0.5,
        borderWidth: 2,
      },
    },
    {
      id: 'encounter-clock',
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

function createInitialCanvasEdges(): Array<CanvasDocumentEdge> {
  return [
    {
      id: 'brief-to-map',
      source: 'scene-brief',
      target: 'market-map',
      type: 'bezier',
      sourceHandle: null,
      targetHandle: null,
      style: { stroke: 'var(--t-blue)', strokeWidth: 2, opacity: 0.65 },
    },
    {
      id: 'brief-to-clock',
      source: 'scene-brief',
      target: 'encounter-clock',
      type: 'step',
      sourceHandle: null,
      targetHandle: null,
      style: { stroke: 'var(--t-orange)', strokeWidth: 2, opacity: 0.7 },
    },
  ]
}
