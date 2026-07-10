import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { SidebarItemMetadataControls } from '../sidebar-item-metadata-controls'

describe('SidebarItemMetadataControls', () => {
  it('labels the icon and color controls for assistive technology', () => {
    render(
      <SidebarItemMetadataControls
        color={null}
        defaultIcon="FileText"
        fallbackName="Untitled Note"
        iconName={null}
        name="Scene Notes"
        onColorChange={vi.fn()}
        onIconNameChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Icon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument()
  })
})
