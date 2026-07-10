import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'

describe('SelectContent', () => {
  it('can raise the portal positioner for nested overlay use cases', () => {
    render(
      <Select open value="view">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent positionerClassName="z-[10000]">
          <SelectItem value="view">View</SelectItem>
        </SelectContent>
      </Select>,
    )

    const selectContent = document.body.querySelector('[data-slot="select-content"]')
    expect(selectContent).toBeInTheDocument()
    expect(selectContent?.parentElement).toHaveClass('z-[10000]')
  })
})
