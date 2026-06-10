import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoWorkspace } from '../demo-workspace'
import type { FileWithContent } from 'shared/files/types'
import type { FileViewerSource } from '~/features/editor/components/viewer/file/file-viewer-source'

const { fileContentViewerMock, localCanvasEditorMock, noteFormattingToolbarMock } = vi.hoisted(
  () => ({
    fileContentViewerMock: vi.fn(),
    localCanvasEditorMock: vi.fn(),
    noteFormattingToolbarMock: vi.fn(),
  }),
)

vi.mock('~/features/editor/components/viewer/file/file-content-viewer', () => ({
  FileContentViewer: (props: Record<string, unknown>) => {
    fileContentViewerMock(props)
    return <div data-testid="file-content-viewer" />
  },
}))

vi.mock('~/features/editor/components/viewer/note/note-editor', () => ({
  NoteEditor: () => <textarea aria-label="Demo note body" data-testid="demo-note-content" />,
}))

vi.mock('../../../editor/components/viewer/sidebar-item-editor', async () => {
  const { FileViewer } = await import('~/features/editor/components/viewer/file/file-viewer')
  const { FileViewerSourceProvider } =
    await import('~/features/editor/components/viewer/file/file-viewer-source')

  return {
    SidebarItemEditor: ({
      files,
      item,
    }: {
      files: { viewer: FileViewerSource }
      item: Record<string, unknown>
    }) => {
      if (item.type === 'file') {
        return (
          <FileViewerSourceProvider value={files.viewer}>
            <FileViewer item={item as FileWithContent} />
          </FileViewerSourceProvider>
        )
      }

      return <textarea aria-label="Demo note body" data-testid="demo-note-content" />
    },
  }
})

vi.mock('~/features/editor/components/formatting-toolbar/note-formatting-toolbar', () => ({
  NoteFormattingToolbar: (props: Record<string, unknown>) => {
    noteFormattingToolbarMock(props)
    return <div role="toolbar" aria-label="Note formatting toolbar" />
  },
}))

vi.mock('~/features/landing/demo-workspace/local-canvas-editor', () => ({
  LocalCanvasEditor: (props: Record<string, unknown>) => {
    localCanvasEditorMock(props)
    return <input aria-label="Demo canvas marker" data-testid="demo-local-canvas-editor" />
  },
}))

const createObjectURLMock = vi.fn((value: Blob | MediaSource) => {
  if (value instanceof File) return `blob:${value.name}`
  return 'blob:demo-default-file'
})
const revokeObjectURLMock = vi.fn()
const URLWithObjectUrls = class extends URL {
  static createObjectURL = createObjectURLMock
  static revokeObjectURL = revokeObjectURLMock
}

describe('DemoWorkspace file viewer integration', () => {
  beforeAll(() => {
    vi.stubGlobal('URL', URLWithObjectUrls)
  })

  beforeEach(() => {
    fileContentViewerMock.mockReset()
    localCanvasEditorMock.mockReset()
    noteFormattingToolbarMock.mockReset()
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('routes demo files through the shared file viewer with local replacement state', async () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))

    await screen.findByText('blue-glass-invoice.txt')
    expect(screen.getByTestId('file-content-viewer')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: false,
      contentType: 'text/plain',
      downloadUrl: expect.stringMatching(/^data:text\/plain;charset=utf-8,/),
      name: 'blue-glass-invoice.txt',
    })

    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('Choose file replacement'), {
      target: { files: [replacement] },
    })

    await screen.findByText('new-clues.txt')
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:new-clues.txt',
      name: 'new-clues.txt',
    })

    fireEvent.click(screen.getByRole('button', { name: 'The Lantern Market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))

    await waitFor(() => {
      expect(screen.getByText('new-clues.txt')).toBeInTheDocument()
    })
  })
})
