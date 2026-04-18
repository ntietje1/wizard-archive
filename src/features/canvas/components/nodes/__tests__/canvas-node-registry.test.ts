import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  canEditCanvasNodeStyle,
  createCanvasNode,
  getCanvasNodeDefinition,
  renderCanvasNodePreview,
} from '../canvas-node-registry'
import type { ReactElement } from 'react'

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
    expect(getCanvasNodeDefinition('text').placement?.startEditingOnCreate).toBe(true)
  })

  it('throws when a node definition has no default data and none is provided', () => {
    expect(() =>
      createCanvasNode('stroke', {
        position: { x: 100, y: 200 },
        size: { width: 20, height: 10 },
      }),
    ).toThrow('Missing default canvas node data for "stroke"')
  })

  it('derives style controls and previews from node definitions', () => {
    expect(canEditCanvasNodeStyle('sticky')).toBe(true)
    expect(canEditCanvasNodeStyle('text')).toBe(false)
    const preview = renderCanvasNodePreview('sticky', {
      label: 'Note',
      color: '#fff',
      opacity: 80,
    })

    expect(preview).not.toBeNull()
    const { container } = render(preview as ReactElement)
    expect(container.textContent).toContain('Note')
    expect(renderCanvasNodePreview('unknown', {})).toBeNull()
  })
})
