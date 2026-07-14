import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { canonicalizeResourceItemTitle, assertResourceItemSlug } from '../../../workspace/items'
import { createFile } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { FileDialog } from '../dialog'
import type { FileUploadControl } from '@wizard-archive/ui/file-upload/control'
import type { FileFormSource } from '../source'

vi.mock('@wizard-archive/ui/components/form-dialog', () => ({
  FormDialog: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? (
      <dialog open aria-label="Edit file">
        {children}
      </dialog>
    ) : null,
}))

vi.mock('../../../filesystem/use-name-validation', () => ({
  useNameValidation: ({ name }: { name: string }) => ({
    debouncedName: name,
    validationError: null,
  }),
}))

describe('FileDialog', () => {
  it('keeps an in-progress edit draft when mutable file metadata refreshes', () => {
    const first = createFile({
      id: testId('file_1'),
      name: 'Original handout',
      assetId: testId('storage_1'),
    })
    const refreshed = { ...first, name: canonicalizeResourceItemTitle('Remote handout update') }
    const props = {
      fileId: first.id,
      isOpen: true,
      onClose: vi.fn(),
      source: createFileFormSource(),
      upload: createUploadControl(),
    }
    const { rerender } = render(
      <FileDialog
        {...props}
        fileState={{ status: 'ready', item: first, isPending: false, error: null }}
      />,
    )

    fireEvent.change(screen.getByLabelText('File Name (optional)'), {
      target: { value: 'Unsaved draft' },
    })
    rerender(
      <FileDialog
        {...props}
        fileState={{ status: 'ready', item: refreshed, isPending: false, error: null }}
      />,
    )

    expect(screen.getByLabelText('File Name (optional)')).toHaveValue('Unsaved draft')
  })
})

function createFileFormSource(): FileFormSource {
  return {
    createItem: vi.fn(() => ({
      status: 'completed' as const,
      id: testId<'sidebarItems'>('created_file'),
      slug: assertResourceItemSlug('created-file'),
    })),
    openItem: vi.fn(),
    replaceFile: vi.fn(({ fileId }) => ({
      status: 'completed' as const,
      receipt: { kind: 'fileReplaced' as const, itemId: fileId, affectedCount: 1 },
    })),
    updateItemMetadata: vi.fn(() => ({
      slug: assertResourceItemSlug('updated-handout'),
    })),
  }
}

function createUploadControl(overrides: Partial<FileUploadControl> = {}): FileUploadControl {
  return {
    file: null,
    fileInputRef: { current: null },
    fileMetadata: null,
    handleDrag: vi.fn(),
    handleDrop: vi.fn(),
    handleFileSelect: vi.fn(),
    isDragActive: false,
    isUploading: false,
    preview: '',
    uploadError: '',
    uploadProgress: { percentage: 0 },
    ...overrides,
  }
}
