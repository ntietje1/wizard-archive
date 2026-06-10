import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoWorkspace } from '../demo-workspace'

const { fileViewerMock, localNoteEditorMock, localCanvasEditorMock, noteFormattingToolbarMock } =
  vi.hoisted(() => ({
    fileViewerMock: vi.fn(),
    localNoteEditorMock: vi.fn(),
    localCanvasEditorMock: vi.fn(),
    noteFormattingToolbarMock: vi.fn(),
  }))

vi.mock('~/features/landing/demo-workspace/local-note-editor', () => ({
  LocalNoteEditor: (props: Record<string, unknown>) => {
    localNoteEditorMock(props)
    return <textarea aria-label="Demo note body" data-testid="demo-note-editor" defaultValue="" />
  },
}))

vi.mock('~/features/editor/components/formatting-toolbar/note-formatting-toolbar', () => ({
  NoteFormattingToolbar: (props: Record<string, unknown>) => {
    noteFormattingToolbarMock(props)
    return <div role="toolbar" aria-label="Note formatting toolbar" />
  },
}))

vi.mock('~/features/editor/components/viewer/file/file-viewer', () => ({
  FileViewer: (props: Record<string, unknown>) => {
    fileViewerMock(props)
    return <div data-testid="demo-file-viewer" />
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
    fileViewerMock.mockReset()
    localNoteEditorMock.mockReset()
    localCanvasEditorMock.mockReset()
    noteFormattingToolbarMock.mockReset()
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('mounts the shared note view boundary as an editable local note', () => {
    render(<DemoWorkspace />)

    expect(screen.getByTestId('demo-note-editor')).toBeInTheDocument()
    expect(localNoteEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          'A waterfront bazaar where every stall hides a second ledger.',
        ),
        className: 'note-editor-surface',
        editable: true,
        noteId: 'note-market',
        onEditorChange: expect.any(Function),
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

    expect(
      screen.getByRole('button', { name: /Toggle history panel, Edited/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View as player' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More options' })).toBeDisabled()
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

    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('Untitled Note')
    expect(screen.getByTestId('selectable-row-Untitled Note')).toBeInTheDocument()
    expect(localNoteEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: '',
        editable: true,
        noteId: 'local-note-2',
      }),
    )
  })

  it('creates blank local canvases and files from the product command list', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Canvas Create a whiteboard to draw and organize nodes' }),
    )

    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('New Canvas')
    expect(localCanvasEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canvasId: 'local-canvas-2',
        nodes: [],
        edges: [],
        SidebarItemEmbedResolver: expect.any(Function),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(screen.getByRole('button', { name: 'File Upload a document, image, or media' }))

    expect(screen.getByRole('textbox', { name: 'Item name' })).toHaveValue('New File 3')
    expect(screen.getByTestId('demo-file-viewer')).toBeInTheDocument()
    expect(fileViewerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          _id: 'local-file-3',
          contentType: 'text/plain',
          name: 'New File 3',
        }),
      }),
    )
  })

  it('renames a local item without leaving the demo workspace', () => {
    render(<DemoWorkspace />)

    const nameInput = screen.getByRole('textbox', { name: 'Item name' })
    fireEvent.focus(nameInput)
    fireEvent.change(nameInput, {
      target: { value: 'Market Leads' },
    })
    fireEvent.blur(nameInput)

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

  it('lets the demo file item use a local file during the page session', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))
    expect(screen.getByTestId('demo-file-viewer')).toBeInTheDocument()
    expect(fileViewerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        item: expect.objectContaining({
          _id: 'file-handout',
          contentType: 'text/plain',
          name: 'Blue-glass Invoice',
        }),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'The Lantern Market' }))
    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))
    expect(screen.getByTestId('demo-file-viewer')).toBeInTheDocument()
  })
})
