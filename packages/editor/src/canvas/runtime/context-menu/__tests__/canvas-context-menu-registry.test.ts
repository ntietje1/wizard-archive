import { testResourceId } from '../../../../../../../shared/test/resource-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createEmbedNodeContextMenuContributor } from '../../../nodes/embed/embed-node-context-menu'
import { buildCanvasContextMenu } from '../canvas-context-menu-registry'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuItem,
  CanvasContextMenuServices,
} from '../canvas-context-menu-types'
import { createCommands } from './canvas-context-menu-test-utils'

function createServices(
  overrides: Partial<CanvasContextMenuServices> = {},
): CanvasContextMenuServices {
  return {
    hasSelectableCanvasItems: () => false,
    selectAllCanvasItems: vi.fn(),
    createEmbedNode: vi.fn(() => null),
    createTextNode: vi.fn(() => null),
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
      'canvas-pane-create-embed',
      'canvas-pane-create-text',
    ])
    expect(menu.flatItems[1]?.disabled).toBe(true)
    expect(menu.flatItems[2]?.disabled).toBe(true)
  })

  it('adds injected create items before text-node creation in the pane New submenu', async () => {
    const createNote = vi.fn()
    const createEmbedNode = vi.fn(() => null)
    const createTextNode = vi.fn(() => null)
    const services = {
      ...createServices(),
      createEmbedNode,
      createTextNode,
    }
    const context = createContext()
    const createItems: Array<CanvasContextMenuItem> = [
      {
        id: 'canvas-pane-create-note',
        label: 'Note',
        group: 'create',
        priority: 10,
        onSelect: createNote,
      },
    ]
    const menu = buildCanvasContextMenu({
      context,
      services,
      commands: createCommands(),
      createItems,
    })

    const createSubmenu = menu.flatItems.find((item) => item.id === 'canvas-pane-create-submenu')
    expect(createSubmenu?.children?.map((item) => item.id)).toEqual([
      'canvas-pane-create-note',
      'canvas-pane-create-embed',
      'canvas-pane-create-text',
    ])
    expect(createSubmenu?.children?.map((item) => item.group)).toEqual([
      'create',
      'create-node',
      'create-node',
    ])

    const noteItem = createSubmenu!.children!.find((item) => item.id === 'canvas-pane-create-note')
    expect(noteItem).toBeDefined()

    const embedItem = createSubmenu!.children!.find(
      (item) => item.id === 'canvas-pane-create-embed',
    )
    expect(embedItem).toBeDefined()

    const textItem = createSubmenu!.children!.find((item) => item.id === 'canvas-pane-create-text')
    expect(textItem).toBeDefined()

    await noteItem!.onSelect()
    await embedItem!.onSelect()
    await textItem!.onSelect()

    expect(createNote).toHaveBeenCalledWith(context, services, undefined)
    expect(createEmbedNode).toHaveBeenCalledWith(context.pointerPosition)
    expect(createTextNode).toHaveBeenCalledWith(context.pointerPosition)
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
    expect(pasteItem?.disabled).toBe(false)
    expect(pasteCommand.canRun).toHaveBeenCalledWith()

    const arrangeItem = menu.flatItems.find((item) => item.id === 'canvas-selection-arrange')
    expect(arrangeItem?.children?.map((item) => item.id)).toEqual([
      'canvas-selection-arrange-alignLeft',
      'canvas-selection-arrange-alignRight',
      'canvas-selection-arrange-alignTop',
      'canvas-selection-arrange-alignBottom',
      'canvas-selection-arrange-alignCenter',
      'canvas-selection-arrange-alignVertical',
      'canvas-selection-arrange-alignHorizontal',
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

  it('merges injected node contributors that expose direct actions', async () => {
    const openEmbedTarget = vi.fn(() => Promise.resolve(true))
    const services = createServices()
    const selection = { nodeIds: new Set(['embed-1']), edgeIds: new Set<string>() }
    const menu = buildCanvasContextMenu({
      context: createContext({
        selection,
        target: {
          kind: 'embed-node',
          nodeId: 'embed-1',
          nodeType: 'embed',
          target: {
            kind: 'resource',
            resourceId: testResourceId('sidebar-1'),
          },
        },
      }),
      services,
      commands: createCommands(),
      contributors: [
        createEmbedNodeContextMenuContributor({
          canOpenEmbedTarget: () => true,
          openEmbedTarget,
        }),
      ],
    })

    expect(menu.flatItems.map((item) => item.id)).toContain('embed-node-open')

    const openItem = menu.flatItems.find((item) => item.id === 'embed-node-open')
    expect(openItem).toBeDefined()

    await openItem!.onSelect()
    expect(openEmbedTarget).toHaveBeenCalledWith({
      kind: 'embed-node',
      nodeId: 'embed-1',
      nodeType: 'embed',
      target: {
        kind: 'resource',
        resourceId: testResourceId('sidebar-1'),
      },
    })
  })
})
