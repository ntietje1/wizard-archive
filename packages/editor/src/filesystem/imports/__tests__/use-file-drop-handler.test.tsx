import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { AnyItem } from '../../../workspace/items'
import type { WorkspaceRuntime } from '../../../workspace/runtime'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { createFolder } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { useFileDropHandler } from '../use-file-drop-handler'

const mocks = vi.hoisted(() => ({
  createItem: vi.fn(),
  importDrop: vi.fn(),
  importFile: vi.fn(),
  openItem: vi.fn(),
  revealItem: vi.fn(),
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: mocks.toast,
}))

describe('useFileDropHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createItem.mockResolvedValue({
      id: testId('folder-created'),
      slug: 'folder-created',
    })
    mocks.importFile.mockResolvedValue({
      status: 'imported',
      kind: 'file',
      fileName: 'file-created.png',
      result: {
        id: testId('file-created'),
        slug: 'file-created',
      },
    })
    mocks.importDrop.mockResolvedValue({
      processedFiles: 0,
      processedFolders: 1,
      skippedFiles: 0,
      lastFolderId: testId('folder-created'),
      skippedFileDetails: [],
    })
    mocks.toast.loading.mockReturnValue('toast-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('imports text file drops through the runtime filesystem import operation', async () => {
    const parentId = testId<'sidebarItems'>('folder-1')
    mocks.importFile.mockResolvedValue({
      status: 'imported',
      kind: 'note',
      fileName: 'notes.txt 1',
      result: {
        id: testId('note-created'),
        slug: 'note-created',
      },
    })
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await act(async () => {
      await result.current.uploadSingleFile(file, parentId, { silent: true })
    })

    expect(mocks.importFile).toHaveBeenCalledWith({
      file: expect.objectContaining({
        contentType: 'text/plain',
        name: 'notes.txt',
        size: 5,
      }),
      parentId,
      onProgress: expect.any(Function),
    })
    expect(mocks.revealItem).toHaveBeenCalledWith('note-created')
    expect(mocks.openItem).toHaveBeenCalledWith('note-created', { replace: true })
  })

  it('imports dropped media files through the runtime filesystem import operation', async () => {
    const parentId = testId<'sidebarItems'>('folder-1')
    mocks.importFile.mockResolvedValue({
      status: 'imported',
      kind: 'file',
      fileName: 'portrait.png 1',
      result: {
        id: testId('file-created'),
        slug: 'file-created',
      },
    })
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    await act(async () => {
      await result.current.uploadSingleFile(file, parentId, { silent: true })
    })

    expect(mocks.importFile).toHaveBeenCalledWith({
      file: expect.objectContaining({
        contentType: 'image/png',
        name: 'portrait.png',
        size: 5,
      }),
      parentId,
      onProgress: expect.any(Function),
    })
    expect(mocks.revealItem).toHaveBeenCalledWith('file-created')
    expect(mocks.openItem).toHaveBeenCalledWith('file-created', { replace: false })
  })

  it('uses the supplied reveal callback for imported files', async () => {
    const runtime = createDropRuntime()
    const revealItem = vi.fn()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem,
      }),
    )
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    await act(async () => {
      await result.current.uploadSingleFile(file, null, { silent: true })
    })

    expect(revealItem).toHaveBeenCalledWith('file-created')
    expect(mocks.openItem).toHaveBeenCalledWith('file-created', { replace: false })
  })

  it('keeps imported file results when reveal navigation reports an error', async () => {
    const navigationError = new Error('Reveal failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.revealItem.mockRejectedValueOnce(navigationError)
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    const upload = await result.current.uploadSingleFile(file, null, { silent: true })

    expect(upload).toEqual({ id: 'file-created', slug: 'file-created' })
    expect(mocks.openItem).toHaveBeenCalledWith('file-created', { replace: false })
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(navigationError))
  })

  it('keeps imported file results when open navigation reports an error', async () => {
    const navigationError = new Error('Open failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.openItem.mockRejectedValueOnce(navigationError)
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    const upload = await result.current.uploadSingleFile(file, null, { silent: true })

    expect(upload).toEqual({ id: 'file-created', slug: 'file-created' })
    expect(mocks.revealItem).toHaveBeenCalledWith('file-created')
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(navigationError))
  })

  it('imports dropped folders through runtime filesystem drop operations', async () => {
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    let dropResult: Awaited<ReturnType<typeof result.current.handleDrop>> | undefined
    await act(async () => {
      dropResult = await result.current.handleDrop({
        files: [],
        rootFolders: [
          {
            name: 'Assets',
            relativePath: 'Assets',
            files: [],
            subfolders: [],
          },
        ],
      })
    })

    expect(mocks.importDrop).toHaveBeenCalledWith({
      files: [],
      rootFolders: [{ name: 'Assets', files: [], subfolders: [] }],
      parentId: null,
      onFileProgress: expect.any(Function),
      onProgress: expect.any(Function),
    })
    expect(mocks.revealItem).toHaveBeenCalledWith('folder-created')
    expect(dropResult).toEqual({
      status: 'completed',
      receipt: {
        processedFiles: 0,
        processedFolders: 1,
        skippedFiles: 0,
        lastFolderId: 'folder-created',
        skippedFileDetails: [],
      },
    })
  })

  it('returns the imported item receipt for a single-file handleDrop', async () => {
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    const dropResult = await result.current.handleDrop({
      files: [{ file: new File(['image'], 'portrait.png'), relativePath: 'portrait.png' }],
      rootFolders: [],
    })

    expect(dropResult).toEqual({
      status: 'completed',
      receipt: {
        id: 'file-created',
        slug: 'file-created',
      },
    })
  })

  it('imports multiple dropped files through runtime filesystem drop operations', async () => {
    const parentId = testId<'sidebarItems'>('assets-folder')
    mocks.importDrop.mockResolvedValue({
      processedFiles: 2,
      processedFolders: 0,
      skippedFiles: 0,
      lastFolderId: null,
      skippedFileDetails: [],
    })
    const runtime = createDropRuntime({
      activeItems: [
        createFolder({
          id: parentId,
          name: 'Assets',
          parentId: null,
        }),
      ],
    })
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const imageFile = new File(['image'], 'portrait.png', { type: 'image/png' })
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    let dropResult: Awaited<ReturnType<typeof result.current.handleDrop>> | undefined
    await act(async () => {
      dropResult = await result.current.handleDrop(
        {
          files: [
            { file: imageFile, relativePath: 'portrait.png' },
            { file: textFile, relativePath: 'notes.txt' },
          ],
          rootFolders: [],
        },
        { destination: { kind: 'assets' } },
      )
    })

    expect(mocks.importDrop).toHaveBeenCalledWith({
      files: [
        {
          file: expect.objectContaining({
            contentType: 'image/png',
            name: 'portrait.png',
            size: 5,
          }),
        },
        {
          file: expect.objectContaining({
            contentType: 'text/plain',
            name: 'notes.txt',
            size: 5,
          }),
        },
      ],
      rootFolders: [],
      parentId,
      onFileProgress: expect.any(Function),
      onProgress: expect.any(Function),
    })
    expect(mocks.revealItem).toHaveBeenCalledWith(parentId)
    expect(dropResult).toEqual({
      status: 'completed',
      receipt: {
        processedFiles: 2,
        processedFolders: 0,
        skippedFiles: 0,
        lastFolderId: null,
        skippedFileDetails: [],
      },
    })
  })

  it('shows and dismisses progress toasts for non-silent single-file uploads', async () => {
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )
    const file = new File(['image'], 'portrait.png', { type: 'image/png' })

    await act(async () => {
      await result.current.uploadSingleFile(file, null)
    })

    expect(mocks.toast.loading).toHaveBeenCalled()
    expect(mocks.toast.dismiss).toHaveBeenCalledWith('toast-1')
    expect(mocks.toast.success).toHaveBeenCalled()
  })

  it('updates single-file progress when the toast identifier is zero', async () => {
    mocks.toast.loading.mockReturnValueOnce(0)
    mocks.importFile.mockImplementationOnce(({ onProgress }) => {
      onProgress({ fileName: 'portrait.png', percentage: 35 })
      return Promise.resolve({
        status: 'imported',
        kind: 'file',
        fileName: 'portrait.png',
        result: {
          id: testId('file-created'),
          slug: 'file-created',
        },
      })
    })
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    await act(async () => {
      await result.current.uploadSingleFile(new File(['image'], 'portrait.png'), null)
    })

    expect(mocks.toast.loading).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 0 }),
    )
  })

  it('dismisses skipped single-file uploads when the toast identifier is zero', async () => {
    mocks.toast.loading.mockReturnValueOnce(0)
    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'portrait.png',
      reason: 'unsupported',
    })
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    await act(async () => {
      await result.current.uploadSingleFile(new File(['image'], 'portrait.png'), null)
    })

    expect(mocks.toast.dismiss).toHaveBeenCalledWith(0)
    expect(mocks.toast.error).toHaveBeenCalledWith('portrait.png: unsupported file type')
  })

  it('surfaces skipped file reasons from all-skipped batch imports', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.importDrop.mockResolvedValue({
      processedFiles: 0,
      processedFolders: 0,
      skippedFiles: 2,
      lastFolderId: null,
      skippedFileDetails: [
        { fileName: 'notes.txt', reason: 'unsupported' },
        { fileName: 'portrait.png', reason: 'invalid', error: 'Too large' },
      ],
    })
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    let dropResult: Awaited<ReturnType<typeof result.current.handleDrop>> | undefined
    await act(async () => {
      dropResult = await result.current.handleDrop({
        files: [
          { file: new File(['hello'], 'notes.txt'), relativePath: 'notes.txt' },
          { file: new File(['image'], 'portrait.png'), relativePath: 'portrait.png' },
        ],
        rootFolders: [],
      })
    })

    expect(mocks.toast.error).toHaveBeenCalled()
    const [content] = mocks.toast.error.mock.calls[0] ?? []
    expect(content).toMatchObject({
      props: {
        message: expect.stringContaining('notes.txt: unsupported file type'),
      },
    })
    expect(content).toMatchObject({
      props: {
        message: expect.stringContaining('portrait.png: Too large'),
      },
    })
    expect(dropResult).toEqual({
      status: 'completed',
      receipt: {
        processedFiles: 0,
        processedFolders: 0,
        skippedFiles: 2,
        lastFolderId: null,
        skippedFileDetails: [
          { fileName: 'notes.txt', reason: 'unsupported' },
          { fileName: 'portrait.png', reason: 'invalid', error: 'Too large' },
        ],
      },
    })
  })

  it('rejects failed batch imports after showing the failure toast', async () => {
    const error = new Error('Drop failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.importDrop.mockRejectedValue(error)
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    await expect(
      result.current.handleDrop({
        files: [
          { file: new File(['hello'], 'notes.txt'), relativePath: 'notes.txt' },
          { file: new File(['image'], 'portrait.png'), relativePath: 'portrait.png' },
        ],
        rootFolders: [],
      }),
    ).rejects.toThrow(error)

    expect(mocks.toast.dismiss).toHaveBeenCalledWith('toast-1')
    expect(mocks.toast.error).toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('reports failed single-file drops through the handleDrop error path', async () => {
    const error = new Error('Single file failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.importFile.mockRejectedValue(error)
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    await expect(
      result.current.handleDrop({
        files: [{ file: new File(['hello'], 'notes.txt'), relativePath: 'notes.txt' }],
        rootFolders: [],
      }),
    ).rejects.toThrow(error)

    expect(mocks.toast.error).toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('warns for invalid and failed silent single-file skips', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const runtime = createDropRuntime()
    const { result } = renderHook(() =>
      useFileDropHandler(runtime.filesystem, {
        openItem: mocks.openItem,
        revealItem: mocks.revealItem,
      }),
    )

    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'invalid.png',
      reason: 'invalid',
      error: 'Too large',
    })
    await act(async () => {
      await result.current.uploadSingleFile(new File(['image'], 'invalid.png'), null, {
        silent: true,
      })
    })

    mocks.importFile.mockResolvedValueOnce({
      status: 'skipped',
      fileName: 'failed.png',
      reason: 'failed',
      error: new Error('Upload failed'),
    })
    await act(async () => {
      await result.current.uploadSingleFile(new File(['image'], 'failed.png'), null, {
        silent: true,
      })
    })

    expect(consoleWarn).toHaveBeenCalledWith('invalid.png: An unexpected error occurred')
    expect(consoleWarn).toHaveBeenCalledWith('failed.png: Upload failed')
  })
})

function createDropRuntime({
  activeItems = [],
}: {
  activeItems?: Array<AnyItem>
} = {}): WorkspaceRuntime {
  const runtime = createTestWorkspaceRuntime({
    activeItems,
    operations: {
      createItem: mocks.createItem,
      importDrop: mocks.importDrop,
      importFile: mocks.importFile,
    },
  })

  return runtime
}
