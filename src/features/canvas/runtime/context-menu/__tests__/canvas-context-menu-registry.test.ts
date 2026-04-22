import { describe, expect, it, vi } from 'vitest'
import { getCanvasNodeContextMenuContributors } from '../../../nodes/canvas-node-modules'
import { buildCanvasContextMenu } from '../canvas-context-menu-registry'
import type {
  CanvasContextMenuContext,
  CanvasContextMenuServices,
} from '../canvas-context-menu-types'

function createServices(
  overrides: Partial<CanvasContextMenuServices> = {},
): CanvasContextMenuServices {
  return {
    canPaste: () => false,
    canCopySnapshot: () => true,
    canOpenEmbedSelection: () => false,
    copySnapshot: vi.fn(() => true),
    cutSnapshot: vi.fn(() => true),
    openEmbedSelection: vi.fn(() => Promise.resolve(true)),
    pasteClipboard: vi.fn(() => null),
    duplicateSnapshot: vi.fn(() => null),
    deleteSnapshot: vi.fn(() => true),
    reorderSnapshot: vi.fn(() => true),
    createAndEmbedSidebarItem: vi.fn(() => Promise.resolve(null)),
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
    canEdit: true,
    ...overrides,
  }
}

describe('buildCanvasContextMenu', () => {
  it('builds the base pane menu with direct submenu actions and disabled paste state', () => {
    const services = createServices({ canPaste: () => false })
    const menu = buildCanvasContextMenu({
      context: createContext(),
      services,
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

  it('builds selection actions in order and runs services directly from onSelect', async () => {
    const copySnapshot = vi.fn(() => true)
    const services = createServices({ copySnapshot })
    const selection = { nodeIds: ['node-1'], edgeIds: [] }
    const menu = buildCanvasContextMenu({
      context: createContext({ selection }),
      services,
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
    expect(copySnapshot).toHaveBeenCalledWith(selection)
  })

  it('merges node contributors that now expose direct actions instead of command ids', async () => {
    const openEmbedSelection = vi.fn(() => Promise.resolve(true))
    const services = createServices({
      canOpenEmbedSelection: () => true,
      openEmbedSelection,
    })
    const selection = { nodeIds: ['embed-1'], edgeIds: [] }
    const contributors = getCanvasNodeContextMenuContributors('embed')
    const menu = buildCanvasContextMenu({
      context: createContext({ selection }),
      services,
      contributors,
    })

    expect(menu.flatItems.map((item) => item.id)).toContain('embed-node-open')

    const openItem = menu.flatItems.find((item) => item.id === 'embed-node-open')
    expect(openItem).toBeDefined()

    await openItem!.onSelect()
    expect(openEmbedSelection).toHaveBeenCalledWith(selection)
  })
})
