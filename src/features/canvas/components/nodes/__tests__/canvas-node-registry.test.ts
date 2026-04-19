import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  canEditCanvasNodeStyle,
  createCanvasNode,
  findCanvasNodeAtPoint,
  getCanvasNodesMatchingLasso,
  getCanvasNodesMatchingRectangle,
  getCanvasNodeModule,
  renderCanvasNodePreview,
} from '../canvas-node-registry'
import type { Node } from '@xyflow/react'

describe('canvas node registry', () => {
  it('creates default text nodes from the text node definition', () => {
    const textNode = createCanvasNode('text', {
      position: { x: 100, y: 200 },
    })

    // Center placement subtracts half the default text node size: 120 / 2 = 60 and 36 / 2 = 18.
    expect(textNode).toMatchObject({
      type: 'text',
      position: { x: 40, y: 182 },
      width: 120,
      height: 36,
      selected: true,
      draggable: true,
      data: { label: 'New text' },
    })
  })

  it('marks new text nodes for immediate editing', () => {
    expect(getCanvasNodeModule('text').placement?.startEditingOnCreate).toBe(true)
  })

  it('throws when a node definition has no default data and none is provided', () => {
    expect(() =>
      createCanvasNode('stroke', {
        position: { x: 100, y: 200 },
        size: { width: 20, height: 10 },
      }),
    ).toThrow('Missing default canvas node data for "stroke"')
  })

  describe('canEditCanvasNodeStyle', () => {
    it('returns true for nodes with style support', () => {
      expect(canEditCanvasNodeStyle('sticky')).toBe(true)
    })

    it('returns false for nodes without style support', () => {
      expect(canEditCanvasNodeStyle('text')).toBe(false)
    })
  })

  describe('renderCanvasNodePreview', () => {
    it('renders a preview for known node types', () => {
      const preview = renderCanvasNodePreview('sticky', {
        label: 'Note',
        color: '#fff',
        opacity: 80,
      })

      expect(preview).not.toBeNull()
      const { container } = render(preview)
      expect(container.textContent).toContain('Note')
    })

    it('returns null for unknown node types', () => {
      expect(renderCanvasNodePreview('unknown', {})).toBeNull()
    })
  })

  describe('node-owned selection helpers', () => {
    it('uses default rectangular selection behavior for rectangle-shaped nodes', () => {
      const nodes: Array<Node> = [
        {
          id: 'sticky-1',
          type: 'sticky',
          position: { x: 10, y: 10 },
          width: 80,
          height: 80,
          data: {},
        },
      ]

      expect(findCanvasNodeAtPoint(nodes, { x: 20, y: 20 }, { zoom: 1 })).toBe('sticky-1')
      expect(
        getCanvasNodesMatchingRectangle(
          nodes,
          { x: 0, y: 0, width: 100, height: 100 },
          { zoom: 1 },
        ),
      ).toEqual(['sticky-1'])
      expect(
        getCanvasNodesMatchingLasso(
          nodes,
          [
            { x: 0, y: 0 },
            { x: 120, y: 0 },
            { x: 120, y: 120 },
            { x: 0, y: 120 },
          ],
          { zoom: 1 },
        ),
      ).toEqual(['sticky-1'])
    })

    it('selects rectangle-shaped nodes when the drag rectangle only partially overlaps them', () => {
      const nodes: Array<Node> = [
        {
          id: 'rectangle-1',
          type: 'rectangle',
          position: { x: 10, y: 10 },
          width: 80,
          height: 80,
          data: {},
        },
      ]

      expect(
        getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 30, height: 30 }, { zoom: 1 }),
      ).toEqual(['rectangle-1'])
    })

    it('uses bespoke stroke selection behavior and safely ignores unknown node types', () => {
      const nodes: Array<Node> = [
        {
          id: 'unknown-1',
          type: 'unknown',
          position: { x: 0, y: 0 },
          width: 10,
          height: 10,
          data: {},
        },
        {
          id: 'stroke-1',
          type: 'stroke',
          position: { x: 0, y: 0 },
          width: 100,
          height: 20,
          data: {
            bounds: { x: 0, y: 0, width: 100, height: 20 },
            points: [
              [0, 10, 0.5],
              [100, 10, 0.5],
            ],
            color: 'var(--foreground)',
            size: 4,
          },
        },
      ]

      expect(findCanvasNodeAtPoint(nodes, { x: 50, y: 20 }, { zoom: 1 })).toBe('stroke-1')
      expect(
        getCanvasNodesMatchingRectangle(nodes, { x: 0, y: 0, width: 40, height: 40 }, { zoom: 1 }),
      ).toEqual(['stroke-1'])
      expect(
        getCanvasNodesMatchingLasso(
          nodes,
          [
            { x: 0, y: 0 },
            { x: 60, y: 0 },
            { x: 60, y: 40 },
            { x: 0, y: 40 },
          ],
          { zoom: 1 },
        ),
      ).toEqual(['stroke-1'])
    })

    it('hit-tests moved strokes using their rendered position', () => {
      const nodes: Array<Node> = [
        {
          id: 'stroke-1',
          type: 'stroke',
          position: { x: 420, y: 240 },
          width: 100,
          height: 20,
          data: {
            bounds: { x: 120, y: 40, width: 100, height: 20 },
            points: [
              [120, 50, 0.5],
              [220, 50, 0.5],
            ],
            color: 'var(--foreground)',
            size: 4,
          },
        },
      ]

      expect(findCanvasNodeAtPoint(nodes, { x: 470, y: 250 }, { zoom: 1 })).toBe('stroke-1')
    })
  })
})
