import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { CanvasWithContent } from 'shared/canvases/types'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { FileWithContent } from 'shared/files/types'
import type { FolderWithContent } from 'shared/folders/types'
import type { GameMapWithContent } from 'shared/game-maps/types'
import type { NoteWithContent } from 'shared/notes/types'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'shared/sidebar-items/types'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'
import { assertNever } from '~/shared/utils/utils'
import type { Id } from 'convex/_generated/dataModel'

export type DemoWorkspaceItemType = 'note' | 'folder' | 'canvas' | 'map' | 'file'

export interface DemoWorkspaceItem {
  id: string
  type: DemoWorkspaceItemType
  title: string
  description: string
}

interface DemoWorkspaceState {
  activeView: 'item' | 'create'
  mountedItemIds: Array<string>
  selectedItemId: string | null
  nextLocalNoteIndex: number
  items: Array<DemoWorkspaceItem>
  noteBodiesById: Record<string, string>
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
  file: {
    id: string
    name: string
    contentType: string
    body: string
  }
}

export type DemoWorkspaceAction =
  | { type: 'createItem'; commandKey: string }
  | { type: 'openCreateDashboard' }
  | { type: 'selectItem'; itemId: string }
  | { type: 'renameItem'; itemId: string; title: string }
  | { type: 'renameSelectedItem'; title: string }

const INITIAL_NOTE_BODY = [
  'A waterfront bazaar where every stall hides a second ledger.',
  '',
  '- Ask Mara about the blue-glass shipment.',
  '- The bell tower guard changes posts after the third tide bell.',
  '- Players know the public auction starts at dusk.',
].join('\n')

const DEMO_TIMESTAMP = Date.now()

export const INITIAL_DEMO_WORKSPACE = createInitialDemoWorkspace()

function createInitialDemoWorkspace(): DemoWorkspaceState {
  return {
    activeView: 'item',
    mountedItemIds: ['note-market'],
    selectedItemId: 'note-market',
    nextLocalNoteIndex: 2,
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
    noteBodiesById: { 'note-market': INITIAL_NOTE_BODY },
    note: {
      id: 'note-market',
      title: 'The Lantern Market',
      body: INITIAL_NOTE_BODY,
    },
    canvas: {
      id: 'canvas-heist',
      nodes: createInitialCanvasNodes(),
      edges: createInitialCanvasEdges(),
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
    case 'createItem':
      return createLocalItem(state, action.commandKey)
    case 'openCreateDashboard':
      return { ...state, activeView: 'create', selectedItemId: null }
    case 'selectItem':
      if (!state.items.some((item) => item.id === action.itemId)) return state
      return {
        ...state,
        activeView: 'item',
        selectedItemId: action.itemId,
        mountedItemIds: state.mountedItemIds.includes(action.itemId)
          ? state.mountedItemIds
          : [...state.mountedItemIds, action.itemId],
      }
    case 'renameItem':
      return renameItem(state, action.itemId, action.title)
    case 'renameSelectedItem':
      return renameSelectedItem(state, action.title)
    default:
      return assertNever(action)
  }
}

export function selectedDemoItem(state: DemoWorkspaceState) {
  if (state.activeView !== 'item') return null
  return state.items.find((item) => item.id === state.selectedItemId) ?? state.items[0] ?? null
}

function demoNoteBodyForItem(state: DemoWorkspaceState, itemId: string) {
  return state.noteBodiesById[itemId] ?? ''
}

export function demoCanvasForItem(state: DemoWorkspaceState, itemId: string) {
  if (itemId === state.canvas.id) {
    return state.canvas
  }

  return { id: itemId, nodes: [], edges: [] }
}

export function demoFileForItem(state: DemoWorkspaceState, item: DemoWorkspaceItem) {
  if (item.id === state.file.id) {
    return state.file
  }

  return {
    id: item.id,
    name: `${item.title || 'Untitled File'}.txt`,
    contentType: 'text/plain',
    body: '',
  }
}

export function demoSidebarItemsWithContent(
  state: DemoWorkspaceState,
): Array<AnySidebarItemWithContent> {
  return createDemoWorkspaceProjection(state).items
}

export function createDemoWorkspaceProjection(state: DemoWorkspaceState) {
  const items = state.items.map((item) => projectDemoSidebarItemWithContent(state, item))
  const itemsById = new Map(items.map((item) => [item._id, item]))

  return { items, itemsById }
}

function projectDemoSidebarItemWithContent(
  state: DemoWorkspaceState,
  item: DemoWorkspaceItem,
): AnySidebarItemWithContent {
  const baseItem = {
    _id: item.id as Id<'sidebarItems'>,
    _creationTime: DEMO_TIMESTAMP,
    name: assertSidebarItemName(item.title || 'Untitled'),
    iconName: null,
    color: null,
    slug: assertSidebarItemSlug(item.id),
    campaignId: 'demo-campaign' as Id<'campaigns'>,
    parentId: null,
    allPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: DEMO_TIMESTAMP,
    updatedBy: null,
    createdBy: 'demo-user' as Id<'userProfiles'>,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
    isActive: true,
    isTrashed: false,
    ancestors: [],
  }

  if (item.type === 'note') {
    const note = {
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.notes,
      content: noteBodyToBlocks(demoNoteBodyForItem(state, item.id)),
      blockMeta: {},
      blockShareAccessWarnings: [],
    } satisfies NoteWithContent
    return note
  }

  if (item.type === 'canvas') {
    const canvas = {
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.canvases,
    } satisfies CanvasWithContent
    return canvas
  }

  if (item.type === 'map') {
    const map = {
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.gameMaps,
      imageStorageId: null,
      imageUrl: null,
      pins: [],
    } satisfies GameMapWithContent
    return map
  }

  if (item.type === 'file') {
    const file = demoFileForItem(state, item)

    const sidebarFile = {
      ...baseItem,
      type: SIDEBAR_ITEM_TYPES.files,
      storageId: null,
      downloadUrl: null,
      contentType: file.contentType,
    } satisfies FileWithContent
    return sidebarFile
  }

  const folder = {
    ...baseItem,
    type: SIDEBAR_ITEM_TYPES.folders,
    inheritShares: false,
  } satisfies FolderWithContent
  return folder
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
  if (state.activeView !== 'item') return state
  const item = selectedDemoItem(state)
  if (!item) return state
  return renameItem(state, item.id, title)
}

function renameItem(state: DemoWorkspaceState, itemId: string, title: string): DemoWorkspaceState {
  const nextTitle = title.trimStart()
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item) return state
  const items = state.items.map((candidate) =>
    candidate.id === item.id ? { ...candidate, title: nextTitle } : candidate,
  )

  if (item.id === state.note.id) {
    return { ...state, items, note: { ...state.note, title: nextTitle } }
  }
  return { ...state, items }
}

function createLocalItem(state: DemoWorkspaceState, commandKey: string): DemoWorkspaceState {
  const type = demoItemTypeForCommand(commandKey)
  const id = `local-${type}-${state.nextLocalNoteIndex}`
  const item: DemoWorkspaceItem = {
    id,
    type,
    title: localItemTitle(type, state.nextLocalNoteIndex),
    description: localItemDescription(type),
  }

  return {
    ...state,
    activeView: 'item',
    items: [...state.items, item],
    mountedItemIds: state.mountedItemIds.includes(id)
      ? state.mountedItemIds
      : [...state.mountedItemIds, id],
    nextLocalNoteIndex: state.nextLocalNoteIndex + 1,
    noteBodiesById: { ...state.noteBodiesById, [id]: '' },
    selectedItemId: id,
  }
}

function demoItemTypeForCommand(commandKey: string): DemoWorkspaceItemType {
  if (commandKey === 'folder') return 'folder'
  if (commandKey === 'canvas') return 'canvas'
  if (commandKey === 'map') return 'map'
  if (commandKey === 'file') return 'file'
  return 'note'
}

function localItemTitle(type: DemoWorkspaceItemType, index: number) {
  const suffix = index === 2 ? '' : ` ${index}`
  if (type === 'folder') return `New Folder${suffix}`
  if (type === 'canvas') return `New Canvas${suffix}`
  if (type === 'map') return `New Map${suffix}`
  if (type === 'file') return `New File${suffix}`
  return `Untitled Note${suffix}`
}

function localItemDescription(type: DemoWorkspaceItemType) {
  if (type === 'folder') return 'Folder'
  if (type === 'canvas') return 'Canvas'
  if (type === 'map') return 'Map pins'
  if (type === 'file') return 'Handout'
  return 'Session note'
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
