import { describe, expect, it, vi } from 'vitest'
import { canvasNodeSpecs } from '../../../nodes/canvas-node-modules'
import {
  buildCanvasContextMenu,
  parseCanvasReorderDirection,
} from '../canvas-context-menu-registry'
import type {
  CanvasContextMenuCommands,
  CanvasContextMenuContext,
  CanvasContextMenuServices,
} from '../canvas-context-menu-types'
import { testId } from '~/test/helpers/test-id'

function createServices(
  overrides: Partial<CanvasContextMenuServices> = {},
): CanvasContextMenuServices {
  return {
    canOpenEmbedTarget: () => false,
    openEmbedTarget: vi.fn(() => Promise.resolve(true)),
    createAndEmbedSidebarItem: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  }
}

function createCommands(
  overrides: Partial<CanvasContextMenuCommands> = {},
): CanvasContextMenuCommands {
  return {
    copy: {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    cut: {
      id: 'cut',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    paste: {
      id: 'paste',
      canRun: vi.fn(() => false),
      run: vi.fn(() => null),
    },
    duplicate: {
      id: 'duplicate',
      canRun: vi.fn(() => true),
      run: vi.fn(() => null),
    },
    delete: {
      id: 'delete',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    reorder: {
      id: 'reorder',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    },
    ...overrides,
  }
}

function createContext(
  overrides: Partial<CanvasContextMenuContext> = {},
): CanvasContextMenuContext {
  return {
    surface: 'canvas',
    pointerPosition: { x: 100, y: 200 },
    selection: { nodeIds: [], edgeIds: [] },
    target: { kind: 'pane' },
    canEdit: true,
    ...overrides,
  }
}

describe('buildCanvasContextMenu', () => {
  it('builds the base pane menu with direct submenu actions and disabled paste state', () => {
    const menu = buildCanvasContextMenu({
      context: createContext(),
      services: createServices(),
      commands: createCommands(),
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual([
      'canvas-pane-create-submenu',
      'canvas-pane-paste',
    ])
    expect(menu.flatItems[0]?.children?.map((item) => item.id)).toEqual([
      'canvas-pane-create-note',
      'canvas-pane-create-folder',
      'canvas-pane-create-map',
      'canvas-pane-create-canvas',
      'canvas-pane-create-file',
    ])
    expect(menu.flatItems[1]?.disabled).toBe(true)
  })

  it('builds selection actions in order and runs shared commands from onSelect', async () => {
    const copyCommand = {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    }
    const selection = { nodeIds: ['node-1'], edgeIds: [] }
    const menu = buildCanvasContextMenu({
      context: createContext({
        selection,
        target: { kind: 'node-selection', nodeIds: selection.nodeIds, nodeType: 'text' },
      }),
      services: createServices(),
      commands: createCommands({ copy: copyCommand }),
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual([
      'canvas-selection-reorder',
      'canvas-selection-cut',
      'canvas-selection-copy',
      'canvas-selection-duplicate',
      'canvas-selection-delete',
    ])

    const copyItem = menu.flatItems.find((item) => item.id === 'canvas-selection-copy')
    expect(copyItem).toBeDefined()

    await copyItem!.onSelect()
    expect(copyCommand.run).toHaveBeenCalledWith({ selection })
  })

  it('merges node contributors that now expose direct actions instead of command ids', async () => {
    const openEmbedTarget = vi.fn(() => Promise.resolve(true))
    const services = createServices({
      canOpenEmbedTarget: () => true,
      openEmbedTarget,
    })
    const selection = { nodeIds: ['embed-1'], edgeIds: [] }
    const contributors = canvasNodeSpecs.embed.contextMenuContributors
    const menu = buildCanvasContextMenu({
      context: createContext({
        selection,
        target: {
          kind: 'embed-node',
          nodeId: 'embed-1',
          nodeType: 'embed',
          sidebarItemId: testId<'sidebarItems'>('sidebar-1'),
        },
      }),
      services,
      commands: createCommands(),
      contributors,
    })

    expect(menu.flatItems.map((item) => item.id)).toContain('embed-node-open')

    const openItem = menu.flatItems.find((item) => item.id === 'embed-node-open')
    expect(openItem).toBeDefined()

    await openItem!.onSelect()
    expect(openEmbedTarget).toHaveBeenCalledWith({
      kind: 'embed-node',
      nodeId: 'embed-1',
      nodeType: 'embed',
      sidebarItemId: testId<'sidebarItems'>('sidebar-1'),
    })
  })

  it('parses valid reorder payloads and rejects malformed ones', () => {
    expect(parseCanvasReorderDirection(null)).toBeNull()
    expect(parseCanvasReorderDirection(undefined)).toBeNull()
    expect(parseCanvasReorderDirection({ direction: 'bringToFront' })).toBeNull()
    expect(parseCanvasReorderDirection({ kind: 'reorder' })).toBeNull()
    expect(parseCanvasReorderDirection({ kind: 'reorder', direction: 'sideways' })).toBeNull()
    expect(parseCanvasReorderDirection('sendToBack')).toBeNull()
    expect(parseCanvasReorderDirection({ kind: 'reorder', direction: 'sendToBack' })).toBe(
      'sendToBack',
    )
    expect(parseCanvasReorderDirection({ kind: 'reorder', direction: 'bringToFront' })).toBe(
      'bringToFront',
    )
    expect(parseCanvasReorderDirection({ kind: 'reorder', direction: 'bringForward' })).toBe(
      'bringForward',
    )
    expect(parseCanvasReorderDirection({ kind: 'reorder', direction: 'sendBackward' })).toBe(
      'sendBackward',
    )
  })
})
