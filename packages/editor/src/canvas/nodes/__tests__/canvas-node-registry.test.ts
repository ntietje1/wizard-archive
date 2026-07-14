import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { testCanvasNodeId } from 'shared/test/canvas-node-id'
import {
  createCanvasNodePlacement,
  getCanvasNodeInspectableProperties,
} from '../canvas-node-modules'
import { normalizeCanvasNode } from '../canvas-node-normalization'
import type { CanvasPaintPropertyBinding } from '../../properties/canvas-property-types'

import { isUuidV7 } from '../../../resources/domain-id'

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
    expect(isUuidV7(node.id)).toBe(true)
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
      data: { target: { kind: 'resource', resourceId: sidebarId('folder-1') } },
    })

    expect(node).toMatchObject({
      type: 'embed',
      position: { x: 40, y: 60 },
      width: 320,
      height: 240,
      data: {
        target: { kind: 'resource', resourceId: 'folder-1' },
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      },
    })
  })

  it('fits default embed size to a provided locked aspect ratio', () => {
    const wide = createCanvasNodePlacement('embed', {
      position: { x: 40, y: 60 },
      data: {
        target: { kind: 'resource', resourceId: sidebarId('wide-file') },
        lockedAspectRatio: 2,
      },
    }).node
    const tall = createCanvasNodePlacement('embed', {
      position: { x: 40, y: 60 },
      data: {
        target: { kind: 'resource', resourceId: sidebarId('tall-file') },
        lockedAspectRatio: 0.5,
      },
    }).node

    expect(wide).toMatchObject({
      width: 320,
      height: 160,
      data: { lockedAspectRatio: 2 },
    })
    expect(tall).toMatchObject({
      width: 120,
      height: 240,
      data: { lockedAspectRatio: 0.5 },
    })
  })

  it('keeps explicit embed size when creation data has a locked aspect ratio', () => {
    const { node } = createCanvasNodePlacement('embed', {
      position: { x: 40, y: 60 },
      size: { width: 200, height: 200 },
      data: {
        target: { kind: 'resource', resourceId: sidebarId('file-1') },
        lockedAspectRatio: 2,
      },
    })

    expect(node).toMatchObject({
      width: 200,
      height: 200,
      data: { lockedAspectRatio: 2 },
    })
  })

  it('uses the default embed size for invalid locked aspect ratios during placement', () => {
    for (const lockedAspectRatio of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { node } = createCanvasNodePlacement('embed', {
        position: { x: 40, y: 60 },
        data: {
          target: { kind: 'resource', resourceId: sidebarId('file-1') },
          lockedAspectRatio,
        },
      } as never)

      expect(node).toMatchObject({
        width: 320,
        height: 240,
      })
      expect(node.data).not.toHaveProperty('lockedAspectRatio')
    }
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
          id: testCanvasNodeId('text-1'),
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

  it('sanitizes invalid surface paint edits before patching text nodes', () => {
    const patchNodeData = vi.fn()
    const properties = getCanvasNodeInspectableProperties(
      normalizeCanvasNode({
        id: testCanvasNodeId('text-1'),
        type: 'text',
        position: { x: 0, y: 0 },
        width: 100,
        height: 80,
        data: {
          backgroundColor: 'var(--surface)',
          backgroundOpacity: 40,
          borderStroke: 'var(--line)',
          borderOpacity: 30,
          textColor: 'var(--text)',
        },
      } as never),
      patchNodeData,
    )
    const textColor = getPaintBinding(properties, 'textColor')
    const fill = getPaintBinding(properties, 'fill')
    const linePaint = getPaintBinding(properties, 'linePaint')

    textColor.setColor('')
    fill.setValue({ color: '', opacity: Number.NaN })
    linePaint.setValue({ color: '', opacity: Number.POSITIVE_INFINITY })

    expect(patchNodeData).toHaveBeenNthCalledWith(1, testCanvasNodeId('text-1'), {
      textColor: 'var(--text)',
    })
    expect(patchNodeData).toHaveBeenNthCalledWith(2, testCanvasNodeId('text-1'), {
      backgroundColor: 'var(--surface)',
      backgroundOpacity: 40,
    })
    expect(patchNodeData).toHaveBeenNthCalledWith(3, testCanvasNodeId('text-1'), {
      borderStroke: 'var(--line)',
      borderOpacity: 30,
    })
  })

  it('omits fill from valid embed node inspectable properties', () => {
    const patchNodeData = vi.fn()

    expect(
      getCanvasNodeInspectableProperties(
        normalizeCanvasNode({
          id: testCanvasNodeId('embed-1'),
          type: 'embed',
          position: { x: 0, y: 0 },
          width: 100,
          height: 80,
          data: {},
        } as never),
        patchNodeData,
      ).bindings.map((binding) => binding.definition.id),
    ).toEqual(['linePaint', 'strokeSize'])
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

function sidebarId(value: string): ResourceId {
  return value as ResourceId
}

function getPaintBinding(
  properties: ReturnType<typeof getCanvasNodeInspectableProperties>,
  id: string,
): CanvasPaintPropertyBinding {
  const binding = properties.bindings.find(
    (candidate): candidate is CanvasPaintPropertyBinding =>
      candidate.definition.kind === 'paint' && candidate.definition.id === id,
  )
  if (!binding) {
    throw new Error(`Missing paint binding "${id}"`)
  }
  return binding
}
