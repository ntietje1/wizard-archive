import { describe, expect, it } from 'vitest'
import { createCanvasNode, getCanvasNodeModule, getCanvasNodeTypes } from '../canvas-node-modules'

describe('canvas node registry', () => {
  it('creates default text nodes from the text node definition', () => {
    const textNode = createCanvasNode('text', {
      position: { x: 100, y: 200 },
    })

    // Center placement subtracts half the default text node size: 320 / 2 = 160 and 240 / 2 = 120.
    expect(textNode).toMatchObject({
      type: 'text',
      position: { x: -60, y: 80 },
      width: 320,
      height: 240,
      selected: true,
      draggable: true,
      data: {
        content: [{ type: 'paragraph' }],
        backgroundColor: 'var(--background)',
        borderStroke: 'var(--border)',
      },
    })
  })

  it('marks new text nodes for immediate editing', () => {
    expect(getCanvasNodeModule('text').placement?.startEditingOnCreate).toBe(true)
  })

  it('merges embed defaults with provided creation data', () => {
    const embedNode = createCanvasNode('embed', {
      position: { x: 40, y: 60 },
      data: { sidebarItemId: 'folder-1' },
    })

    expect(embedNode).toMatchObject({
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

  it('derives React Flow node renderers from the node modules', () => {
    expect(getCanvasNodeTypes().text).toBe(getCanvasNodeModule('text').NodeComponent)
  })

  it('throws when a node definition has no default data and none is provided', () => {
    expect(() =>
      createCanvasNode('stroke', {
        position: { x: 100, y: 200 },
        size: { width: 20, height: 10 },
      }),
    ).toThrow('Missing default canvas node data for "stroke"')
  })
})
