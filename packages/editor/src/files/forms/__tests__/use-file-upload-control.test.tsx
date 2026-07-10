import { act, renderHook } from '@testing-library/react'
import type { DragEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useFileUploadControl } from '../use-file-upload-control'

describe('useFileUploadControl', () => {
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const createObjectUrl = vi.fn((file: File) => `blob:${file.name}`)
  const revokeObjectUrl = vi.fn()

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    })
    createObjectUrl.mockClear()
    revokeObjectUrl.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL')
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL)
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL')
    }
  })

  it('applies the size cap before custom file validators', () => {
    const validator = vi.fn(() => ({ valid: true }) as const)
    const { result } = renderHook(() =>
      useFileUploadControl({
        fileTypeValidator: validator,
        isOpen: true,
        maxFileSize: 1024 * 1024,
      }),
    )
    const oversizedFile = new File([new Uint8Array(1024 * 1024 + 1)], 'large.txt', {
      type: 'text/plain',
    })

    act(() => {
      result.current.handleFileSelect(oversizedFile)
    })

    expect(result.current.uploadError).toBe('File must be less than 1MB')
    expect(validator).not.toHaveBeenCalled()
  })

  it('clears the staged upload when a later selection is invalid', () => {
    const { result } = renderHook(() =>
      useFileUploadControl({
        isOpen: true,
        maxFileSize: 4,
      }),
    )
    let selectionResult: unknown

    act(() => {
      selectionResult = result.current.handleFileSelect(
        new File(['ok'], 'ok.txt', { type: 'text/plain' }),
      )
    })
    expect(selectionResult).toEqual({ valid: true })
    expect(result.current.fileMetadata?.name).toBe('ok.txt')
    expect(result.current.preview).toBe('blob:ok.txt')

    act(() => {
      selectionResult = result.current.handleFileSelect(
        new File(['too-large'], 'large.txt', { type: 'text/plain' }),
      )
    })

    expect(selectionResult).toEqual({
      valid: false,
      error: 'File must be less than 0.0000038MB',
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        file: null,
        fileMetadata: null,
        preview: '',
        uploadError: 'File must be less than 0.0000038MB',
      }),
    )
  })

  it('resets selected upload state when the dialog closes', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useFileUploadControl({
          isOpen,
        }),
      { initialProps: { isOpen: true } },
    )
    const selectedFile = new File(['notes'], 'notes.txt', { type: 'text/plain' })

    act(() => {
      result.current.handleFileSelect(selectedFile)
    })
    expect(result.current.fileMetadata).toEqual({
      name: 'notes.txt',
      size: selectedFile.size,
      type: 'text/plain',
    })

    rerender({ isOpen: false })

    expect(result.current).toEqual(
      expect.objectContaining({
        file: null,
        fileMetadata: null,
        preview: '',
        uploadError: '',
      }),
    )
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:notes.txt')
  })

  it('uses object URLs for image previews without storing data URLs in state', () => {
    const { result } = renderHook(() =>
      useFileUploadControl({
        isOpen: true,
      }),
    )

    act(() => {
      result.current.handleFileSelect(new File(['image'], 'portrait.png', { type: 'image/png' }))
    })

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(File))
    expect(result.current.preview).toBe('blob:portrait.png')
  })

  it('does not let existing file initialization replace an in-progress selection', () => {
    const { result, rerender } = renderHook(
      ({
        existingName,
        existingPreviewUrl,
      }: {
        existingName: string
        existingPreviewUrl: string
      }) =>
        useFileUploadControl({
          existingContentType: 'application/pdf',
          existingName,
          existingPreviewUrl,
          existingSize: 10,
          isOpen: true,
        }),
      {
        initialProps: {
          existingName: 'original.pdf',
          existingPreviewUrl: 'https://files/original',
        },
      },
    )
    const selectedFile = new File(['draft'], 'draft.txt', { type: 'text/plain' })

    act(() => {
      result.current.handleFileSelect(selectedFile)
    })
    rerender({ existingName: 'remote-update.pdf', existingPreviewUrl: 'https://files/remote' })

    expect(result.current.fileMetadata).toEqual({
      name: 'draft.txt',
      size: selectedFile.size,
      type: 'text/plain',
    })
    expect(result.current.preview).toBe('blob:draft.txt')
  })

  it('keeps nested drop zones active until the outer drag leaves', () => {
    const { result } = renderHook(() =>
      useFileUploadControl({
        isOpen: true,
      }),
    )

    act(() => {
      result.current.handleDrag(createDragEvent('dragenter'))
      result.current.handleDrag(createDragEvent('dragenter'))
      result.current.handleDrag(createDragEvent('dragleave'))
    })

    expect(result.current.isDragActive).toBe(true)

    act(() => {
      result.current.handleDrag(createDragEvent('dragleave'))
    })

    expect(result.current.isDragActive).toBe(false)
  })

  it('keeps drag state controlled by enter, leave, and drop events', () => {
    const { result } = renderHook(() =>
      useFileUploadControl({
        isOpen: true,
      }),
    )

    act(() => {
      result.current.handleDrag(createDragEvent('dragenter'))
    })
    expect(result.current.isDragActive).toBe(true)

    act(() => {
      result.current.handleDrag(createDragEvent('dragend'))
    })

    expect(result.current.isDragActive).toBe(true)
  })

  it('rejects multi-file drops instead of silently choosing one file', () => {
    const { result } = renderHook(() =>
      useFileUploadControl({
        isOpen: true,
      }),
    )

    act(() => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: [
            new File(['first'], 'first.txt', { type: 'text/plain' }),
            new File(['second'], 'second.txt', { type: 'text/plain' }),
          ],
        },
      } as unknown as DragEvent<HTMLDivElement>)
    })

    expect(result.current.uploadError).toBe('Drop one file at a time')
    expect(result.current.fileMetadata).toBeNull()
  })
})

function createDragEvent(type: string) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type,
  } as unknown as DragEvent<HTMLDivElement>
}
