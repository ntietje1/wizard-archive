import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  createTestNoteContentSource,
  createTestNotePermissionContentSource,
} from '../../../test/note-content-source-factory'
import { CanvasEditorRuntimeHost } from '../canvas-editor-runtime-host'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { ReactNode } from 'react'

const renderCanvasSurface = vi.hoisted(() => vi.fn())

vi.mock('../canvas-editor-surface', () => ({
  CanvasEditorSurface: () => renderCanvasSurface(),
}))

vi.mock('../../runtime/providers/canvas-runtime', () => ({
  CanvasRuntimeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../../react/canvas-engine-context', () => ({
  CanvasEngineProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe('CanvasEditorRuntimeHost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the canvas surface without owning embedded note preview transport', async () => {
    renderCanvasSurface.mockImplementation(() => <div>Canvas surface</div>)
    const noteSource = createTestNoteContentSource()

    render(
      <CanvasEditorRuntimeHost
        canvasId={'canvas-1' as SidebarItemId}
        canEdit={true}
        canvasCursor="pointer"
        isSidebarItemEmbedRichTextEditable={() => true}
        noteDocumentSource={noteSource.document}
        noteEmbeddedNoteContentSource={noteSource.embeddedNotes}
        noteEmbedTargetSource={noteSource.embedTargets}
        noteLinkCreationSource={noteSource.linkCreation}
        noteLinkNavigationSource={noteSource.linkNavigation}
        noteLinkResolutionSource={noteSource.linkResolution}
        notePlaybackSource={noteSource.playback}
        notePermissionSource={createTestNotePermissionContentSource()}
        noteSharingSource={noteSource.sharing}
        noteValueReferences={noteSource.valueReferences}
        noteValueStateSource={noteSource.valueState}
        noteWikiLinkSource={noteSource.wikiLinks}
        NodeContentComponent={() => null}
        runtime={createRuntime()}
      />,
    )

    expect(await screen.findByText('Canvas surface')).toBeInTheDocument()

    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'packages/editor/src/canvas/components/canvas-editor-runtime-host.tsx',
      ),
      'utf8',
    )
    expect(source).not.toContain(['EmbeddedNotePreviewRenderer', 'Boundary'].join(''))
    expect(source).not.toContain(['createEmbeddedNote', 'PreviewRenderer'].join(''))
  })
})

function createRuntime(): Parameters<typeof CanvasEditorRuntimeHost>[0]['runtime'] {
  return {
    canvasEngine: {},
    canvasSurfaceRef: { current: null },
    commands: {},
    contextMenu: {},
    documentWriter: {},
    domRuntime: {},
    editSession: {},
    history: {},
    nodeActions: {},
    remoteNodeHighlights: {},
    remoteEdgeHighlights: {},
    remoteUsers: [],
    sceneHandlers: {},
    selection: {},
    viewportController: {},
  } as unknown as Parameters<typeof CanvasEditorRuntimeHost>[0]['runtime']
}
