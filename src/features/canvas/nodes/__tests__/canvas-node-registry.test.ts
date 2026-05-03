import { describe, expect, it, vi } from 'vitest'
import {
  createCanvasNodePlacement,
  getCanvasNodeInspectableProperties,
  normalizeCanvasNode,
} from '../canvas-node-modules'
import type { Id } from 'convex/_generated/dataModel'
import { canvasNodeTypes } from '../canvas-node-renderers'
import { TextNode } from '../text/text-node'

describe('canvas node specs', () => {
  it('creates default text nodes from the text node spec', () => {
    const { node } = createCanvasNodePlacement('text', {
      position: { x: 100, y: 200 },
    })

    expect(node).toMatchObject({
      type: 'text',
      position: { x: -60, y: 80 },
      width: 320,
      height: 240,
      data: {
        content: [{ type: 'paragraph' }],
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      },
    })
    expect(createCanvasNodePlacement('text', { position: { x: 100, y: 200 } }).selectOnCreate).toBe(
      true,
    )
  })

  it('marks new text nodes for immediate editing', () => {
    expect(
      createCanvasNodePlacement('text', {
        position: { x: 0, y: 0 },
      }).startEditing,
    ).toBe(true)
  })

  it('merges embed defaults with provided creation data', () => {
    const { node } = createCanvasNodePlacement('embed', {
      position: { x: 40, y: 60 },
      data: { sidebarItemId: 'folder-1' as Id<'sidebarItems'> },
    })

    expect(node).toMatchObject({
      type: 'embed',
      position: { x: 40, y: 60 },
      width: 320,
      height: 240,
      data: {
        sidebarItemId: 'folder-1',
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      },
    })
  })

  it('exposes the static canvas node renderers', () => {
    expect(canvasNodeTypes.text).toBe(TextNode)
  })

  it('returns empty inspectable properties for invalid raw nodes', () => {
    const patchNodeData = vi.fn()

    expect(
      getCanvasNodeInspectableProperties(
        normalizeCanvasNode({
          id: 'bad-text',
          type: 'text',
          position: { x: 0, y: 0 },
          data: null,
        } as never),
        patchNodeData,
      ).bindings,
    ).toEqual([])
  })

  it('returns typed inspectable properties for valid text nodes', () => {
    const patchNodeData = vi.fn()

    expect(
      getCanvasNodeInspectableProperties(
        normalizeCanvasNode({
          id: 'text-1',
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          height: 80,
          data: {},
        } as never),
        patchNodeData,
      ).bindings.map((binding) => binding.definition.id),
    ).toEqual(['textColor', 'fill', 'linePaint', 'strokeSize'])
  })

  it('throws when a node spec has no default data and none is provided', () => {
    expect(() =>
      createCanvasNodePlacement('stroke', {
        position: { x: 100, y: 200 },
        size: { width: 20, height: 10 },
      }),
    ).toThrow('Missing default canvas node data for "stroke"')
  })
})
