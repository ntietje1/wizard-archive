import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoWorkspace } from '../demo-workspace'

const {
  fileContentViewerMock,
  localCanvasEditorMock,
  noteFormattingToolbarMock,
  rawNoteContentMock,
} = vi.hoisted(() => ({
  fileContentViewerMock: vi.fn(),
  localCanvasEditorMock: vi.fn(),
  noteFormattingToolbarMock: vi.fn(),
  rawNoteContentMock: vi.fn(),
}))

vi.mock('~/features/editor/components/raw-note-content', () => ({
  RawNoteContent: (props: Record<string, unknown>) => {
    rawNoteContentMock(props)
    return <textarea aria-label="Demo note body" data-testid="demo-note-editor" defaultValue="" />
  },
}))

vi.mock('~/features/editor/components/formatting-toolbar/note-formatting-toolbar', () => ({
  NoteFormattingToolbar: (props: Record<string, unknown>) => {
    noteFormattingToolbarMock(props)
    return <div role="toolbar" aria-label="Note formatting toolbar" />
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
    noteFormattingToolbarMock.mockReset()
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
    expect(screen.getByRole('toolbar', { name: 'Note formatting toolbar' })).toBeInTheDocument()
    expect(noteFormattingToolbarMock).toHaveBeenCalledWith(
      expect.objectContaining({ visible: true }),
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

  it('renders the app-like editor chrome without restoring the removed demo wrapper labels', () => {
    render(<DemoWorkspace />)

    expect(screen.getByRole('button', { name: 'Last edited today' })).toHaveTextContent(
      'Edited today',
    )
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View as player' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trash' })).not.toBeInTheDocument()
    expect(screen.getByText('Lanterns of Brindlehook')).toBeInTheDocument()
    expect(screen.queryByText('Demo campaign')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset demo' })).not.toBeInTheDocument()
  })

  it('opens the create dashboard and creates a local note from the product command list', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByRole('heading', { name: 'Create New' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Note Write and organize your thoughts' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Note Write and organize your thoughts' }))

    expect(screen.getByRole('textbox', { name: 'Selected item name' })).toHaveValue('Untitled Note')
    expect(screen.getByTestId('selectable-row-Untitled Note')).toBeInTheDocument()
    expect(rawNoteContentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editable: true,
        noteId: 'local-note-2',
        content: [],
      }),
    )
  })

  it('creates blank local canvases and files from the product command list', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Canvas Create a whiteboard to draw and organize nodes' }),
    )

    expect(screen.getByRole('textbox', { name: 'Selected item name' })).toHaveValue('New Canvas')
    expect(localCanvasEditorMock).toHaveBeenLastCalledWith({
      canvasId: 'local-canvas-2',
      nodes: [],
      edges: [],
    })

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(screen.getByRole('button', { name: 'File Upload a document, image, or media' }))

    expect(screen.getByRole('textbox', { name: 'Selected item name' })).toHaveValue('New File 3')
    expect(screen.getByText('New File 3.txt')).toBeInTheDocument()
    expect(screen.getByText('text/plain · 0 B')).toBeInTheDocument()
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:demo-default-file',
      name: 'New File 3.txt',
    })
  })

  it('renames a local item without leaving the demo workspace', () => {
    render(<DemoWorkspace />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Selected item name' }), {
      target: { value: 'Market Leads' },
    })

    expect(screen.getByTestId('selectable-row-Market Leads')).toBeInTheDocument()
    expect(screen.getByTestId('demo-note-editor')).toBeInTheDocument()
  })

  it('keeps mounted editor state while navigating during the page session', () => {
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
  })

  it('lets the demo file item use a local file during the page session', async () => {
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
  })
})
