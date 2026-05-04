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
    hasSelectableCanvasItems: () => false,
    selectAllCanvasItems: vi.fn(),
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
    arrange: {
      id: 'arrange',
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
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
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
      'canvas-pane-select-all',
      'canvas-paste',
    ])
    expect(menu.flatItems[0]?.children?.map((item) => item.id)).toEqual([
      'canvas-pane-create-note',
      'canvas-pane-create-folder',
      'canvas-pane-create-map',
      'canvas-pane-create-canvas',
      'canvas-pane-create-file',
    ])
    expect(menu.flatItems[1]?.disabled).toBe(true)
    expect(menu.flatItems[2]?.disabled).toBe(true)
  })

  it('builds selection actions in order and runs shared commands from onSelect', async () => {
    const copyCommand = {
      id: 'copy',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    }
    const pasteCommand = {
      id: 'paste',
      canRun: vi.fn(() => true),
      run: vi.fn(() => ({ nodeIds: new Set(['pasted-node']), edgeIds: new Set<string>() })),
    }
    const selection = { nodeIds: new Set(['node-1', 'node-2']), edgeIds: new Set<string>() }
    const menu = buildCanvasContextMenu({
      context: createContext({
        selection,
        target: { kind: 'node-selection', nodeIds: ['node-1', 'node-2'], nodeType: 'text' },
      }),
      services: createServices(),
      commands: createCommands({ copy: copyCommand, paste: pasteCommand }),
    })

    expect(menu.flatItems.map((item) => item.id)).toEqual([
      'canvas-selection-reorder',
      'canvas-selection-arrange',
      'canvas-paste',
      'canvas-selection-cut',
      'canvas-selection-copy',
      'canvas-selection-duplicate',
      'canvas-selection-delete',
    ])

    const pasteItem = menu.flatItems.find((item) => item.id === 'canvas-paste')
    expect(pasteItem).toBeDefined()
    expect(pasteItem?.scope).toBe('base')
    expect(pasteItem?.disabled).toBe(false)
    expect(pasteCommand.canRun).toHaveBeenCalledWith()

    const arrangeItem = menu.flatItems.find((item) => item.id === 'canvas-selection-arrange')
    expect(arrangeItem?.children?.map((item) => item.id)).toEqual([
      'canvas-selection-arrange-alignLeft',
      'canvas-selection-arrange-alignRight',
      'canvas-selection-arrange-alignTop',
      'canvas-selection-arrange-alignBottom',
      'canvas-selection-arrange-distributeHorizontal',
      'canvas-selection-arrange-distributeVertical',
      'canvas-selection-arrange-flipHorizontal',
      'canvas-selection-arrange-flipVertical',
    ])
    expect(arrangeItem?.children?.map((item) => item.group)).toEqual([
      'arrange-align',
      'arrange-align',
      'arrange-align',
      'arrange-align',
      'arrange-distribute',
      'arrange-distribute',
      'arrange-flip',
      'arrange-flip',
    ])

    const copyItem = menu.flatItems.find((item) => item.id === 'canvas-selection-copy')
    expect(copyItem).toBeDefined()

    const deleteItem = menu.flatItems.find((item) => item.id === 'canvas-selection-delete')
    expect(deleteItem?.variant).toBe('danger')

    await pasteItem!.onSelect()
    expect(pasteCommand.run).toHaveBeenCalledWith()

    await copyItem!.onSelect()
    expect(copyCommand.run).toHaveBeenCalledWith({ selection })
  })

  it('hides arrange until multiple selected nodes can be arranged', () => {
    const buildSelectionMenu = (selection: CanvasContextMenuContext['selection']) =>
      buildCanvasContextMenu({
        context: createContext({
          selection,
          target:
            selection.nodeIds.size > 0
              ? {
                  kind: 'node-selection',
                  nodeIds: Array.from(selection.nodeIds),
                  nodeType: 'text',
                }
              : { kind: 'edge-selection', edgeIds: Array.from(selection.edgeIds), edgeType: null },
        }),
        services: createServices(),
        commands: createCommands(),
      })

    expect(
      buildSelectionMenu({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set<string>(),
      }).flatItems.some((item) => item.id === 'canvas-selection-arrange'),
    ).toBe(false)
    expect(
      buildSelectionMenu({
        nodeIds: new Set(['node-1']),
        edgeIds: new Set(['edge-1']),
      }).flatItems.some((item) => item.id === 'canvas-selection-arrange'),
    ).toBe(false)
    expect(
      buildSelectionMenu({
        nodeIds: new Set(['node-1', 'node-2']),
        edgeIds: new Set<string>(),
      }).flatItems.some((item) => item.id === 'canvas-selection-arrange'),
    ).toBe(true)
    expect(
      buildSelectionMenu({
        nodeIds: new Set<string>(),
        edgeIds: new Set(['edge-1', 'edge-2']),
      }).flatItems.some((item) => item.id === 'canvas-selection-arrange'),
    ).toBe(false)
  })

  it('runs arrangement submenu items with the selected canvas nodes', async () => {
    const arrangeCommand = {
      id: 'arrange',
      canRun: vi.fn(() => true),
      run: vi.fn(() => true),
    }
    const selection = { nodeIds: new Set(['node-1', 'node-2']), edgeIds: new Set<string>() }
    const menu = buildCanvasContextMenu({
      context: createContext({
        selection,
        target: { kind: 'node-selection', nodeIds: ['node-1', 'node-2'], nodeType: 'text' },
      }),
      services: createServices(),
      commands: createCommands({ arrange: arrangeCommand }),
    })

    const arrangeItem = menu.flatItems.find((item) => item.id === 'canvas-selection-arrange')
    expect(arrangeItem).toBeDefined()
    const alignLeftItem = arrangeItem!.children?.find(
      (item) => item.id === 'canvas-selection-arrange-alignLeft',
    )
    expect(alignLeftItem).toBeDefined()
    expect(alignLeftItem?.disabled).toBe(false)

    await alignLeftItem!.onSelect()

    expect(arrangeCommand.canRun).toHaveBeenCalledWith({
      selection,
      action: 'alignLeft',
    })
    expect(arrangeCommand.run).toHaveBeenCalledWith({
      selection,
      action: 'alignLeft',
    })
  })

  it('merges node contributors that now expose direct actions instead of command ids', async () => {
    const openEmbedTarget = vi.fn(() => Promise.resolve(true))
    const services = createServices({
      canOpenEmbedTarget: () => true,
      openEmbedTarget,
    })
    const selection = { nodeIds: new Set(['embed-1']), edgeIds: new Set<string>() }
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
