import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoWorkspace } from '../demo-workspace'

const { fileContentViewerMock, localCanvasEditorMock, rawNoteContentMock } = vi.hoisted(() => ({
  fileContentViewerMock: vi.fn(),
  localCanvasEditorMock: vi.fn(),
  rawNoteContentMock: vi.fn(),
}))

vi.mock('~/features/editor/components/raw-note-content', () => ({
  RawNoteContent: (props: Record<string, unknown>) => {
    rawNoteContentMock(props)
    return <textarea aria-label="Demo note body" data-testid="demo-note-editor" defaultValue="" />
  },
}))

vi.mock('~/features/editor/components/viewer/file/file-content-viewer', () => ({
  FileContentViewer: (props: Record<string, unknown>) => {
    fileContentViewerMock(props)
    return <div data-testid="demo-file-content-viewer" />
  },
}))

vi.mock('~/features/landing/demo-workspace/local-canvas-editor', () => ({
  LocalCanvasEditor: (props: Record<string, unknown>) => {
    localCanvasEditorMock(props)
    return (
      <input
        aria-label="Demo canvas marker"
        data-testid="demo-local-canvas-editor"
        defaultValue=""
      />
    )
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

describe('DemoWorkspace', () => {
  beforeAll(() => {
    vi.stubGlobal('URL', URLWithObjectUrls)
  })

  beforeEach(() => {
    fileContentViewerMock.mockReset()
    localCanvasEditorMock.mockReset()
    rawNoteContentMock.mockReset()
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('mounts the real note content boundary as an editable local note', () => {
    render(<DemoWorkspace />)

    expect(screen.getByTestId('demo-note-editor')).toBeInTheDocument()
    expect(rawNoteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        noteId: 'note-market',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'paragraph',
            content: expect.arrayContaining([
              expect.objectContaining({
                text: 'A waterfront bazaar where every stall hides a second ledger.',
              }),
            ]),
          }),
        ]),
      }),
    )
  })

  it('navigates inside the demo sidebar and mounts the local canvas editor runtime', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))

    expect(screen.getByTestId('demo-local-canvas-editor')).toBeInTheDocument()
    expect(localCanvasEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canvasId: 'canvas-heist',
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'scene-brief', type: 'text' }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({ id: 'brief-to-map', source: 'scene-brief' }),
        ]),
      }),
    )
  })

  it('keeps demo sidebar rows free of inert app-only controls', () => {
    render(<DemoWorkspace />)

    expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument()
  })

  it('renames a local item without leaving the demo workspace', () => {
    render(<DemoWorkspace />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Selected item name' }), {
      target: { value: 'Market Leads' },
    })

    expect(screen.getByTestId('selectable-row-Market Leads')).toBeInTheDocument()
    expect(screen.getByTestId('demo-note-editor')).toBeInTheDocument()
  })

  it('resets local sidebar edits', () => {
    render(<DemoWorkspace />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Selected item name' }), {
      target: { value: 'Market Leads' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))

    expect(screen.getByTestId('selectable-row-The Lantern Market')).toBeInTheDocument()
  })

  it('keeps mounted editor state while navigating until reset', () => {
    render(<DemoWorkspace />)

    fireEvent.change(screen.getByLabelText('Demo note body'), {
      target: { value: 'typed market note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))
    fireEvent.change(screen.getByLabelText('Demo canvas marker'), {
      target: { value: 'moved encounter node' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'The Lantern Market' }))

    expect(screen.getByLabelText('Demo note body')).toHaveValue('typed market note')

    fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))
    expect(screen.getByLabelText('Demo canvas marker')).toHaveValue('moved encounter node')

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(screen.getByLabelText('Demo note body')).toHaveValue('')
  })

  it('lets the demo file item use a local file until reset', async () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))
    expect(screen.getByText('blue-glass-invoice.txt')).toBeInTheDocument()
    expect(screen.getByTestId('demo-file-content-viewer')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:demo-default-file',
      name: 'blue-glass-invoice.txt',
    })

    const replacement = new File(['new clues'], 'new-clues.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('Choose demo file'), {
      target: { files: [replacement] },
    })

    expect(screen.getByText('new-clues.txt')).toBeInTheDocument()
    await waitFor(() =>
      expect(fileContentViewerMock).toHaveBeenLastCalledWith({
        allowObjectUrl: true,
        contentType: 'text/plain',
        downloadUrl: 'blob:new-clues.txt',
        name: 'new-clues.txt',
      }),
    )
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:demo-default-file')

    fireEvent.click(screen.getByRole('button', { name: 'The Lantern Market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))
    expect(screen.getByText('new-clues.txt')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:new-clues.txt',
      name: 'new-clues.txt',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }))
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:new-clues.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))
    expect(screen.getByText('blue-glass-invoice.txt')).toBeInTheDocument()
  })
})
