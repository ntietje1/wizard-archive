import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { describe, expect, it } from 'vite-plus/test'
import { SidebarRow } from '../sidebar-row'

describe('SidebarRow', () => {
  it('exposes the full label as a title for truncated rows', () => {
    render(<SidebarRow icon={FileText} label="A very long campaign resource name" />)

    expect(screen.getByText('A very long campaign resource name')).toHaveAttribute(
      'title',
      'A very long campaign resource name',
    )
  })

  it('marks active rows', () => {
    render(<SidebarRow icon={FileText} isActive label="Active note" />)

    expect(screen.getByText('Active note').closest('[data-active]')).toHaveAttribute(
      'data-active',
      'true',
    )
  })

  it('renders right-side row content', () => {
    render(<SidebarRow icon={FileText} label="Note" rightSlot={<span>Updated</span>} />)

    expect(screen.getByText('Updated')).toBeInTheDocument()
  })
})
