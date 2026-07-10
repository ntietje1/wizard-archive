import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { SidebarItemUploadField } from '../sidebar-item-upload-field'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'

describe('SidebarItemUploadField', () => {
  it('labels the file input with the visible field label', () => {
    render(
      <SidebarItemUploadField
        acceptPattern="image/*"
        dragDropText="Drag an image here or click to browse"
        isSubmitting={false}
        label="Map Image"
        upload={createUploadControl()}
      />,
    )

    const input = screen.getByLabelText('Map Image')

    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'image/*')
  })
})

function createUploadControl(): FileUploadControl {
  return {
    file: null,
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
  }
}
