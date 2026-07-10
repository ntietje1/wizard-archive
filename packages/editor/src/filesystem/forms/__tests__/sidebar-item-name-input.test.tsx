import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { SidebarItemNameInput } from '../sidebar-item-name-input'

describe('SidebarItemNameInput', () => {
  it('announces name validation progress without adding an unlabeled control', () => {
    render(
      <SidebarItemNameInput
        disabled={false}
        errors={[]}
        isValidating
        label="Map Name"
        name="map-name"
        onBlur={vi.fn()}
        onChange={vi.fn()}
        placeholder="Name this map"
        value="Dungeon Level 1"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Map Name' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Checking Map Name' })).toBeInTheDocument()
  })

  it('describes invalid fields with the validation message', () => {
    render(
      <SidebarItemNameInput
        disabled={false}
        errors={['A map with this name already exists']}
        isValidating={false}
        label="Map Name"
        name="map-name"
        onBlur={vi.fn()}
        onChange={vi.fn()}
        placeholder="Name this map"
        value="Dungeon Level 1"
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Map Name' })).toHaveAccessibleDescription(
      'A map with this name already exists',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('A map with this name already exists')
  })

  it('keeps label associations unique when multiple fields share the same form name', () => {
    render(
      <>
        <SidebarItemNameInput
          disabled={false}
          errors={[]}
          isValidating={false}
          label="First Map Name"
          name="map-name"
          onBlur={vi.fn()}
          onChange={vi.fn()}
          placeholder="Name this map"
          value="Dungeon Level 1"
        />
        <SidebarItemNameInput
          disabled={false}
          errors={[]}
          isValidating={false}
          label="Second Map Name"
          name="map-name"
          onBlur={vi.fn()}
          onChange={vi.fn()}
          placeholder="Name this map"
          value="Dungeon Level 2"
        />
      </>,
    )

    const first = screen.getByRole('textbox', { name: 'First Map Name' })
    const second = screen.getByRole('textbox', { name: 'Second Map Name' })
    expect(first).toHaveAttribute('name', 'map-name')
    expect(second).toHaveAttribute('name', 'map-name')
    expect(first.id).not.toBe(second.id)
  })
})
