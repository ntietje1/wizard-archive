import { act, render, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { MapImageUpload } from '../map-image-upload'
import { FileUploadEmptyState } from '@wizard-archive/ui/file-upload/empty-state'
import type { ResourceOperationResult } from '../../../filesystem/transaction-contract'
import { completedMapImageUpdate } from './test-fixtures'

vi.mock('@wizard-archive/ui/file-upload/empty-state', () => ({
  FileUploadEmptyState: vi.fn(() => <div data-testid="map-image-upload" />),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('MapImageUpload', () => {
  let objectUrls: ReturnType<typeof spyObjectUrls>

  beforeEach(() => {
    vi.mocked(FileUploadEmptyState).mockClear()
    objectUrls = spyObjectUrls()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('reports indeterminate upload progress while the map image upload is pending', async () => {
    const onUpload = vi.fn(() => new Promise<ResourceOperationResult>(() => undefined))
    render(<MapImageUpload onUpload={onUpload} />)
    const image = new File(['image'], 'map.png', { type: 'image/png' })

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(image)
    })

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledExactlyOnceWith(image)
    })
    await waitFor(() => {
      expect(lastFileUploadProps().fileUpload).toMatchObject({
        isUploading: true,
        uploadProgress: { percentage: 0 },
      })
      expect(lastFileUploadProps()).toMatchObject({
        isSubmitting: true,
      })
    })
  })

  it('keeps the active map image while another upload is pending', async () => {
    const upload = createDeferred<ResourceOperationResult>()
    const onUpload = vi.fn(() => upload.promise)
    render(<MapImageUpload onUpload={onUpload} />)

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(
        new File(['image'], 'map.png', { type: 'image/png' }),
      )
    })
    await waitFor(() => {
      expect(lastFileUploadProps().fileUpload.fileMetadata).toMatchObject({ name: 'map.png' })
    })

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(
        new File(['text'], 'notes.txt', { type: 'text/plain' }),
      )
    })

    expect(lastFileUploadProps().fileUpload).toMatchObject({
      preview: 'blob:map.png',
      uploadError: '',
      isUploading: true,
    })
    expect(onUpload).toHaveBeenCalledOnce()

    await act(async () => {
      upload.resolve(completedMapImageUpdate())
      await upload.promise
    })
  })

  it('reports synchronous upload failures through the upload state', async () => {
    const onUpload = vi.fn(() => {
      throw new Error('upload rejected')
    })
    render(<MapImageUpload onUpload={onUpload} />)

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(
        new File(['image'], 'map.png', { type: 'image/png' }),
      )
    })

    await waitFor(() => {
      expect(lastFileUploadProps().fileUpload).toMatchObject({
        uploadError: 'Failed to update map',
        isUploading: false,
      })
    })
  })

  it('reports image preview failures for the active selection', () => {
    objectUrls.createObjectURL.mockImplementation(() => {
      throw new Error('preview failed')
    })
    const onUpload = vi.fn(() => new Promise<ResourceOperationResult>(() => undefined))
    render(<MapImageUpload onUpload={onUpload} />)

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(
        new File(['image'], 'map.png', { type: 'image/png' }),
      )
    })

    expect(lastFileUploadProps().fileUpload).toMatchObject({
      preview: '',
      uploadError: 'Failed to preview map image',
    })
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('fails a hanging active upload and clears upload progress', async () => {
    vi.useFakeTimers()
    const onUpload = vi.fn(() => new Promise<ResourceOperationResult>(() => undefined))
    render(<MapImageUpload onUpload={onUpload} />)

    act(() => {
      lastFileUploadProps().fileUpload.handleFileSelect(
        new File(['image'], 'map.png', { type: 'image/png' }),
      )
    })

    expect(lastFileUploadProps().fileUpload.isUploading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(lastFileUploadProps().fileUpload).toMatchObject({
      uploadError: 'Map image upload timed out. Please try again.',
      isUploading: false,
    })
  })
})

function lastFileUploadProps(): ComponentProps<typeof FileUploadEmptyState> {
  const props = vi.mocked(FileUploadEmptyState).mock.lastCall?.[0]
  if (!props) {
    throw new Error('FileUploadEmptyState was not rendered')
  }
  return props
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function spyObjectUrls() {
  ensureObjectUrlMethod('createObjectURL', () => 'blob:preview')
  ensureObjectUrlMethod('revokeObjectURL', () => undefined)
  const createObjectURL = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation((file: Blob | MediaSource) =>
      file instanceof File ? `blob:${file.name}` : 'blob:preview',
    )
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  return { createObjectURL, revokeObjectURL }
}

function ensureObjectUrlMethod<TMethod extends 'createObjectURL' | 'revokeObjectURL'>(
  method: TMethod,
  value: (typeof URL)[TMethod],
) {
  if (method in URL) return
  Object.defineProperty(URL, method, {
    configurable: true,
    writable: true,
    value,
  })
}
