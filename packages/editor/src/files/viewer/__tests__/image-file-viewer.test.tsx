import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ImageFileViewer } from '../image-file-viewer'

vi.mock('react-zoom-pan-pinch', () => ({
  TransformComponent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TransformWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('ImageFileViewer', () => {
  it('renders invalid image URLs as an alert without rendering the image', () => {
    render(<ImageFileViewer imageUrl="http://example.com/image.png" alt="Portrait" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid Image URL')
    expect(screen.queryByAltText('Portrait')).not.toBeInTheDocument()
  })

  it('announces image load failures', () => {
    render(<ImageFileViewer imageUrl="https://example.com/image.png" alt="Portrait" />)

    fireEvent.error(screen.getByAltText('Portrait'))

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load image')
  })
})
