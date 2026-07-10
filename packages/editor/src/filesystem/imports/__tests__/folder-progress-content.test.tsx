import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { FileProgressContent } from '../file-progress-content'
import { FolderProgressContent } from '../folder-progress-content'

describe('FolderProgressContent', () => {
  it('advances folder-only imports with processed folder progress', () => {
    render(
      <FolderProgressContent
        progress={{
          toastId: 'toast-1',
          totalFiles: 0,
          totalFolders: 2,
          processedFiles: 0,
          processedFolders: 1,
          skippedFiles: 0,
        }}
      />,
    )

    expect(screen.getByText('Folders: 1/2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('counts skipped files as completed folder progress', () => {
    render(
      <FolderProgressContent
        progress={{
          toastId: 'toast-1',
          totalFiles: 2,
          totalFolders: 1,
          processedFiles: 1,
          processedFolders: 1,
          skippedFiles: 1,
        }}
      />,
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Skipped: 1')).toBeInTheDocument()
  })
})

describe('FileProgressContent', () => {
  it('counts skipped files as completed file progress', () => {
    render(<FileProgressContent totalFiles={2} processedFiles={1} skippedFiles={1} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
