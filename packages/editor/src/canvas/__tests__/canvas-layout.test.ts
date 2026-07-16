import { describe, expect, it } from 'vite-plus/test'
import { fitCanvasContent } from '../canvas-layout'
import { canvasToScreenPoint } from '../canvas-viewport'
import { createCanvasTextDocument } from '../text/model'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE_ID = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')

describe('canvas layout', () => {
  it('fits visible document bounds around the surface center', () => {
    const viewport = fitCanvasContent(
      [
        {
          id: NODE_ID,
          type: 'text',
          position: { x: 100, y: 50 },
          width: 180,
          height: 80,
          data: {},
        },
      ],
      500,
      300,
    )
    expect(viewport).not.toBeNull()
    expect(canvasToScreenPoint({ x: 190, y: 90 }, viewport!)).toEqual({ x: 250, y: 150 })
  })

  it('does not fit an empty or fully hidden document', () => {
    expect(fitCanvasContent([], 500, 300)).toBeNull()
    expect(
      fitCanvasContent(
        [
          {
            id: NODE_ID,
            type: 'text',
            position: { x: 0, y: 0 },
            hidden: true,
            data: {},
          },
        ],
        500,
        300,
      ),
    ).toBeNull()
  })
})

describe('canvas text presentation', () => {
  it('creates canonical text content without a second model', () => {
    const content = createCanvasTextDocument('Wizards')
    expect(content[0]?.content).toEqual([{ type: 'text', text: 'Wizards' }])
  })
})
