import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { CanvasTextPreview } from '../canvas-text-preview'
import { generateUuidV7 } from '../../resources/domain-id'

describe('CanvasTextPreview', () => {
  it('renders canonical rich formatting without constructing an editor per node', () => {
    render(
      <CanvasTextPreview
        content={[
          {
            id: generateUuidV7(),
            type: 'heading',
            props: { level: 2, textAlignment: 'center' },
            content: [
              {
                type: 'text',
                text: 'Harbor plan',
                styles: { bold: true, italic: true, textColor: 'red' },
              },
            ],
            children: [
              {
                id: generateUuidV7(),
                type: 'checkListItem',
                props: { checked: true },
                content: [{ type: 'text', text: 'Secure the docks' }],
              },
            ],
          },
        ]}
        selected
        style={{ color: 'rgb(30, 41, 59)' }}
      />,
    )

    const heading = screen.getByRole('heading', { level: 2, name: /Harbor plan/ })
    expect(heading).toHaveStyle({ textAlign: 'center' })
    expect(screen.getByText('Harbor plan')).toHaveStyle({
      color: 'rgb(224, 62, 62)',
      fontStyle: 'italic',
      fontWeight: '700',
    })
    expect(screen.getByText(/Secure the docks/)).toBeVisible()
  })
})
