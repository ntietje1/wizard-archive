import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_DEMO_WORKSPACE } from '~/features/landing/demo-workspace/demo-workspace-model'
import CanvasFeatureDemoIsland from '../canvas-feature-demo-island'
import HeroProductDemoIsland from '../hero-product-demo-island'
import WorkspaceFeatureDemoIsland from '../workspace-feature-demo-island'

const {
  canvasReadOnlyPreviewMock,
  createObjectURLMock,
  createdObjectUrlValue,
  fileContentViewerMock,
  rawNoteContentMock,
  revokeObjectURLMock,
} = vi.hoisted(() => {
  const capturedObjectUrl = { current: undefined as Blob | MediaSource | undefined }

  return {
    canvasReadOnlyPreviewMock: vi.fn(),
    createdObjectUrlValue: capturedObjectUrl,
    createObjectURLMock: vi.fn((value: Blob | MediaSource) => {
      capturedObjectUrl.current = value
      return 'blob:generated-landing-file'
    }),
    fileContentViewerMock: vi.fn(),
    rawNoteContentMock: vi.fn(),
    revokeObjectURLMock: vi.fn(),
  }
})

vi.mock('~/features/canvas/components/canvas-read-only-preview', () => ({
  CanvasReadOnlyPreview: (props: Record<string, unknown>) => {
    canvasReadOnlyPreviewMock(props)
    return <div data-testid="landing-canvas-preview" />
  },
}))

vi.mock('~/features/editor/components/raw-note-content', () => ({
  RawNoteContent: (props: Record<string, unknown>) => {
    rawNoteContentMock(props)
    return <div data-testid="landing-note-content">Note surface</div>
  },
}))

vi.mock('~/features/editor/components/viewer/file/file-content-viewer', () => ({
  FileContentViewer: (props: Record<string, unknown>) => {
    fileContentViewerMock(props)
    return (
      <a data-testid="landing-file-content-viewer" href={String(props.downloadUrl)}>
        Open {String(props.name)}
      </a>
    )
  },
}))

const URLWithObjectUrls = class extends URL {
  static createObjectURL = createObjectURLMock
  static revokeObjectURL = revokeObjectURLMock
}

describe('landing feature demos', () => {
  beforeAll(() => {
    vi.stubGlobal('URL', URLWithObjectUrls)
  })

  beforeEach(() => {
    canvasReadOnlyPreviewMock.mockReset()
    createdObjectUrlValue.current = undefined
    createObjectURLMock.mockClear()
    fileContentViewerMock.mockReset()
    rawNoteContentMock.mockReset()
    revokeObjectURLMock.mockClear()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('renders the workspace feature as an editor-only link autocomplete preview', () => {
    render(<WorkspaceFeatureDemoIsland />)

    expect(
      screen.getByRole('region', { name: 'Text editor link autocomplete preview' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('landing-note-content')).toBeInTheDocument()
    expect(rawNoteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
        content: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringMatching(/\[\[Mara Vell\]\].*\[\[Blue-glass Invoice\]\]/),
              }),
            ]),
          }),
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringMatching(
                  /\[\[The Lantern Market\]\].*\[\[Harbor Heist Board\]\].*\[\[moon/,
                ),
              }),
            ]),
          }),
        ]),
      }),
    )
    const suggestionMenu = screen.getByLabelText('Link suggestions')
    expect(suggestionMenu).toBeInTheDocument()
    expect(screen.getByText('Moonwell Docks').closest('[data-selected]')).toHaveAttribute(
      'data-selected',
      'true',
    )
    expect(screen.getByText('Moonlit Warehouse')).toBeInTheDocument()
    expect(screen.getByText('Moon Market Escape')).toBeInTheDocument()
    expect(screen.queryByText('Ephemeral demo data')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo campaign')).not.toBeInTheDocument()
    expect(screen.queryByText('Lanterns of Brindlehook')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Landing preview items' }),
    ).not.toBeInTheDocument()
  })

  it('lets the hero preview navigate between production-derived surfaces', async () => {
    const { unmount } = render(<HeroProductDemoIsland />)

    expect(await screen.findByText('Edited today')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(screen.getByTitle('View as player')).toBeInTheDocument()
    expect(screen.getByTitle('More options')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View as player' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.queryByText('Trash')).not.toBeInTheDocument()
    expect(screen.getByText('Lanterns of Brindlehook')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: 'Harbor Heist Board' }))

    expect(screen.getByTestId('landing-canvas-preview')).toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interactive: false,
        nodes: expect.arrayContaining([expect.objectContaining({ id: 'scene-brief' })]),
        edges: expect.arrayContaining([expect.objectContaining({ id: 'brief-to-map' })]),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Blue-glass Invoice' }))

    await waitFor(() =>
      expect(screen.getByTestId('landing-file-content-viewer')).toBeInTheDocument(),
    )
    expect(fileContentViewerMock).toHaveBeenLastCalledWith({
      allowObjectUrl: true,
      contentType: 'text/plain',
      downloadUrl: 'blob:generated-landing-file',
      name: 'blue-glass-invoice.txt',
    })
    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob))
    expect(createdObjectUrlValue.current).toBeInstanceOf(Blob)
    await expect((createdObjectUrlValue.current as Blob).text()).resolves.toBe(
      INITIAL_DEMO_WORKSPACE.file.body,
    )

    unmount()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:generated-landing-file')
  })

  it('renders the standalone canvas demo through the read-only canvas surface', () => {
    render(<CanvasFeatureDemoIsland />)

    expect(screen.getByTestId('landing-canvas-preview')).toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
    )
  })
})
