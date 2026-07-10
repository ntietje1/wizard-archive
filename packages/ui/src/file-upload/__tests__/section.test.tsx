import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileUploadControl } from '../control'
import { FileUploadSection } from '../section'

describe('FileUploadSection', () => {
  it('opens previews without granting opener access', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    render(
      <FileUploadSection
        acceptPattern="image/*"
        dragDropText="Drop a file"
        fileUpload={createFileUploadControl({ preview: 'blob:preview' })}
        isSubmitting={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open file preview' }))

    expect(open).toHaveBeenCalledWith('blob:preview', '_blank', 'noopener,noreferrer')
    open.mockRestore()
  })
})

function createFileUploadControl(overrides: Partial<FileUploadControl> = {}): FileUploadControl {
  return {
    file: new File(['preview'], 'preview.png', { type: 'image/png' }),
    preview: '',
    fileMetadata: null,
    isUploading: false,
    uploadError: '',
    isDragActive: false,
    uploadProgress: { percentage: 0 },
    fileInputRef: createRef<HTMLInputElement>(),
    handleFileSelect: vi.fn(),
    handleDrag: vi.fn(),
    handleDrop: vi.fn(),
    ...overrides,
  }
}
