import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { WorkspaceSurface } from '../surface'

vi.mock('@wizard-archive/ui/components/error-fallback', () => ({
  ErrorFallback: () => <div role="alert">Workspace section failed</div>,
}))

describe('WorkspaceSurface', () => {
  it('keeps the editor content mounted when the topbar throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      render(
        <WorkspaceSurface
          topbar={<ThrowingSlot />}
          banner={<div>Banner</div>}
          rightSidebar={<div>Right sidebar</div>}
        >
          <div>Editor content</div>
        </WorkspaceSurface>,
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(screen.getByText('Editor content')).toBeInTheDocument()
    expect(screen.getByText('Banner')).toBeInTheDocument()
    expect(screen.getByText('Right sidebar')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Workspace section failed')
  })
})

function ThrowingSlot(): ReactNode {
  throw new Error('topbar failed')
}
