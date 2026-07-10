import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { OtherFileViewer } from '../other-file-viewer'

describe('OtherFileViewer', () => {
  it('renders an invalid file URL message for unsafe URLs', () => {
    render(<OtherFileViewer fileUrl="http://example.com/file.zip" fileName="archive.zip" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid File URL')
    expect(screen.queryByRole('link', { name: /open file in new tab/i })).toBeNull()
  })

  it('allows object URLs only when the caller opts in', () => {
    const { rerender } = render(
      <OtherFileViewer fileUrl="blob:https://example.com/file" fileName="archive.zip" />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid File URL')

    rerender(
      <OtherFileViewer
        allowObjectUrl
        fileUrl="blob:https://example.com/file"
        fileName="archive.zip"
      />,
    )

    expect(screen.getByText('archive.zip')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open file in new tab/i })).toHaveAttribute(
      'href',
      'blob:https://example.com/file',
    )
  })

  it('renders file name and open link for valid URLs', () => {
    render(<OtherFileViewer fileUrl="https://example.com/file.zip" fileName="archive.zip" />)

    expect(screen.getByText('archive.zip')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open file in new tab/i })).toHaveAttribute(
      'href',
      'https://example.com/file.zip',
    )
  })
})
