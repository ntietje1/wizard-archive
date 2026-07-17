import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { CanvasReadonlyPreview } from '../canvas-readonly-preview'
import { createCanvasDocumentDoc } from '../document-contract'
import { assertDomainId, DOMAIN_ID_KIND } from '../../resources/domain-id'

const NODE = assertDomainId(DOMAIN_ID_KIND.canvasNode, '01890f47-65f2-7cc0-8a3b-111111111111')

afterEach(() => vi.restoreAllMocks())

describe('CanvasReadonlyPreview', () => {
  it('fits from transform-invariant layout dimensions', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    const document = createCanvasDocumentDoc({
      nodes: [
        {
          id: NODE,
          type: 'text',
          position: { x: 0, y: 0 },
          width: 100,
          height: 50,
          data: {},
        },
      ],
      edges: [],
    })

    render(<CanvasReadonlyPreview document={document} />)

    expect(screen.getByTestId('canvas-readonly-preview').firstElementChild).toHaveStyle({
      transform: 'translate(48px, 74px) scale(3.04)',
    })
  })
})
