import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea } from '../input-group'

describe('InputGroupAddon', () => {
  it('focuses the grouped input control from pointer and keyboard activation', () => {
    render(
      <InputGroup>
        <InputGroupAddon>Search</InputGroupAddon>
        <InputGroupInput aria-label="Search" />
      </InputGroup>,
    )

    const addon = screen.getByText('Search')

    fireEvent.click(addon)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus()
  })

  it('focuses a grouped textarea control', () => {
    render(
      <InputGroup>
        <InputGroupAddon>Description</InputGroupAddon>
        <InputGroupTextarea aria-label="Description" />
      </InputGroup>,
    )

    const addon = screen.getByText('Description')

    fireEvent.keyDown(addon, { key: 'Enter' })
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveFocus()
  })
})
