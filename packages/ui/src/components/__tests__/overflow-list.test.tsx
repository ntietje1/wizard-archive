import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverflowList } from '../overflow-list'

describe('OverflowList', () => {
  it('renders dedicated measurement content in the hidden sizing tree', () => {
    const { container } = render(
      <OverflowList
        items={[
          {
            key: 'one',
            content: (
              <button type="button" data-testid="visible-action">
                One
              </button>
            ),
            measurementContent: <span data-testid="measurement-chip">One</span>,
          },
        ]}
        getOverflowItem={(hiddenCount) => <button type="button">{hiddenCount} more</button>}
        getOverflowMeasurementItem={(hiddenCount) => <span>{hiddenCount} more</span>}
      />,
    )

    expect(container.querySelectorAll('[data-testid="visible-action"]')).toHaveLength(1)
    expect(
      container.querySelector('[data-overflow-list-item] [data-testid="measurement-chip"]'),
    ).toHaveTextContent('One')
  })
})
