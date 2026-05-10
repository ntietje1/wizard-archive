import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'

describe('TooltipContent', () => {
  it('can raise the portal positioner for nested overlay use cases', () => {
    render(
      <Tooltip open>
        <TooltipTrigger render={<button type="button">Info</button>} />
        <TooltipContent positionerClassName="z-[10000]">More detail</TooltipContent>
      </Tooltip>,
    )

    const tooltip = document.body.querySelector('[data-slot="tooltip-content"]')
    expect(tooltip).toBeInTheDocument()
    if (!tooltip) throw new Error('Tooltip content was not rendered')
    expect(tooltip.parentElement).toHaveClass('z-[10000]')
  })
})
