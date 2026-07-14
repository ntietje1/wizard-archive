import { testResourceId } from '../../../../../../../shared/test/resource-id'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { NoteItemWithContent } from '../../../../notes/item-contract'
import { SidebarItemContent } from '../content'
import type { FileSession } from '../../../../files/session-contract'
import type { FileItemWithContent } from '../../../../files/item-contract'
import type { ResourceHistory } from '../../../../filesystem/history-types'
import { NoteScrollRequestProvider } from '../../../../notes/scroll-request-provider'
import type { NoteEditorSource } from '../../../../notes/viewer/note-editor-source'
import { WorkspaceSidebarRevealProvider } from '../../reveal-provider'
import { createFile, createNote } from '../../../../test/sidebar-item-factory'
import {
  createMemoryWorkspaceViewStateStores,
  createTestWorkspaceRuntime,
} from '../../../../test/workspace-runtime-factory'
import { testHistoryEntryId } from '../../../../test/history-entry-id'
import { createRuntimeSidebarItemViewerSource } from '../runtime-source'
import { SidebarItemViewer } from '../sidebar-item-viewer'
import { PERMISSION_LEVEL } from '../../../../../../../shared/permissions/types'

const historyMocks = vi.hoisted(() => ({
  restoreRollback: vi.fn(),
}))

type ResourceHistoryAvailable = Extract<ResourceHistory, { status: 'available' }>

vi.mock('../../../../notes/viewer/note-editor', () => ({
  NoteEditor: ({ source }: { source: NoteEditorSource }) => (
    <div
      data-scroll-request-status={source.scrollRequest.status}
      data-sharing-status={source.sharing.status}
    >
      note editor
    </div>
  ),
}))
vi.mock('../../../../game-maps/viewer/viewer', () => ({ MapViewer: () => <div /> }))
vi.mock('../../../../folders/viewer/viewer', () => ({ FolderViewer: () => <div /> }))
vi.mock('../../../../files/viewer/viewer', () => ({ FileViewer: () => <div /> }))
vi.mock('../../../../canvas/viewer/viewer', () => ({ CanvasViewer: () => <div /> }))
vi.mock('../../../../filesystem/history-preview/viewer', () => ({
  HistoryPreviewViewer: ({ state }: { state: { status: string } }) => (
    <div data-testid="history-preview" data-status={state.status} />
  ),
}))
vi.mock('../../../../filesystem/history-preview/rollback-confirm-dialog', () => ({
  RollbackConfirmDialog: ({ state }: { state: { status: string } }) => (
    <div data-testid="rollback-dialog" data-status={state.status} />
  ),
}))

describe('SidebarItemContent', () => {
  beforeEach(() => {
    historyMocks.restoreRollback.mockReset()
  })

  it('renders loaded item content', () => {
    const item: NoteItemWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    renderWithSidebarReveal(
      <SidebarItemContent
        item={item}
        runtime={createRuntime()}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('dispatches loaded item content from the runtime source', () => {
    const item: NoteItemWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    const runtime = createRuntime()

    render(
      <SidebarItemViewer
        item={item}
        source={createRuntimeSidebarItemViewerSource(runtime, {
          noteScrollRequest: { status: 'none' },
          showItemInSidebar: vi.fn(),
          viewStateStores: createMemoryWorkspaceViewStateStores(),
        })}
      />,
    )

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('allows edit-share files to be replaced through the runtime source', () => {
    const runtime = createRuntime()
    const source = createRuntimeSidebarItemViewerSource(runtime, {
      noteScrollRequest: { status: 'none' },
      showItemInSidebar: vi.fn(),
      viewStateStores: createMemoryWorkspaceViewStateStores(),
    })
    const file = {
      ...createFile({ myPermissionLevel: PERMISSION_LEVEL.EDIT }),
      ancestors: [],
    } as FileItemWithContent

    expect(source.resolveFile().canReplaceFile(file)).toBe(true)
  })

  it('reports unsupported viewer item type without dumping item content', () => {
    const item = {
      ...createNote({
        id: testResourceId('unsupported-1'),
        name: 'Secret Note',
      }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [{ id: 'secret-block', type: 'paragraph' }],
      type: 'unsupported',
    } as unknown as NoteItemWithContent
    const source = {
      resolveCanvas: vi.fn(),
      resolveFile: vi.fn(),
      resolveFolder: vi.fn(),
      resolveMap: vi.fn(),
      resolveNote: vi.fn(),
    }

    expect(() => render(<SidebarItemViewer item={item} source={source} />)).toThrow(
      new RegExp(item.id),
    )
    expect(() => render(<SidebarItemViewer item={item} source={source} />)).not.toThrow(
      /Secret Note|secret-block/,
    )
  })

  it('passes the notes-owned scroll request into the note editor source', () => {
    const item: NoteItemWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }

    render(
      <NoteScrollRequestProvider value={{ status: 'requested' }}>
        {withSidebarReveal(
          <SidebarItemContent
            item={item}
            runtime={createRuntime()}
            viewStateStores={createMemoryWorkspaceViewStateStores()}
          />,
        )}
      </NoteScrollRequestProvider>,
    )

    expect(screen.getByText('note editor')).toHaveAttribute(
      'data-scroll-request-status',
      'requested',
    )
  })

  it('renders a note without constructing inactive viewer session sources', () => {
    const item: NoteItemWithContent = {
      ...createNote(),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const runtime = createRuntime()
    const noteSession = runtime.sessions.note
    const noteHeadings = runtime.sessions.noteHeadings
    const notePlayback = runtime.sessions.notePlayback
    const noteValues = runtime.sessions.noteValues

    Object.defineProperty(runtime, 'sessions', {
      value: {
        get canvas() {
          throw new Error('Canvas session should not be required for note content')
        },
        get file() {
          throw new Error('File session should not be required for note content')
        },
        get map() {
          throw new Error('Map session should not be required for note content')
        },
        note: noteSession,
        noteHeadings,
        notePlayback,
        noteValues,
      },
    })

    renderWithSidebarReveal(
      <SidebarItemContent
        item={item}
        runtime={runtime}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByText('note editor')).toBeInTheDocument()
  })

  it('renders the source-provided history preview when present', () => {
    const item: NoteItemWithContent = {
      ...createNote({ id: testResourceId('note-1') }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const entryId = testHistoryEntryId('history-1')

    renderWithSidebarReveal(
      <SidebarItemContent
        item={item}
        runtime={createRuntime({
          history: createHistory(item, {
            preview: { status: 'loading', entryTime: undefined },
            previewingEntryId: entryId,
          }),
        })}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByTestId('history-preview')).toHaveAttribute('data-status', 'loading')
  })

  it('renders the runtime rollback dialog while item content is visible', () => {
    const item: NoteItemWithContent = {
      ...createNote({ id: testResourceId('note-1') }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const entryId = testHistoryEntryId('history-1')

    renderWithSidebarReveal(
      <SidebarItemContent
        item={item}
        runtime={createRuntime({
          history: createHistory(item, {
            rollback: {
              status: 'ready',
              entryTime: Date.UTC(2026, 0, 1),
              isRestoring: false,
            },
            rollbackEntryId: entryId,
          }),
        })}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByText('note editor')).toBeInTheDocument()
    expect(screen.getByTestId('rollback-dialog')).toHaveAttribute('data-status', 'ready')
  })

  it('clears the editor-owned history session when the item unmounts', () => {
    const item: NoteItemWithContent = {
      ...createNote({ id: testResourceId('note-1') }),
      ancestors: [],
      content: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
    }
    const clearItemSession = vi.fn()

    const { unmount } = renderWithSidebarReveal(
      <SidebarItemContent
        item={item}
        runtime={createRuntime({
          history: createHistory(item, {
            clearItemSession,
          }),
        })}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    unmount()

    expect(clearItemSession).toHaveBeenCalledTimes(1)
  })

  function createHistory(
    item: NoteItemWithContent,
    overrides: Partial<ResourceHistoryAvailable> = {},
  ): ResourceHistoryAvailable {
    return {
      status: 'available',
      itemId: item.id,
      entries: {
        loadMore: vi.fn(),
        state: {
          canEdit: true,
          entries: [],
          membersMap: new Map(),
          myMemberId: null,
          previewingEntryId: null,
          status: 'Exhausted',
        },
      },
      previewingEntryId: null,
      preview: { status: 'unavailable', entryTime: undefined },
      previewEntry: vi.fn(),
      rollbackEntryId: null,
      rollback: { status: 'closed', isRestoring: false },
      requestRollback: vi.fn(),
      restoreRollback: historyMocks.restoreRollback,
      clearPreview: vi.fn(),
      clearRollback: vi.fn(),
      clearItemSession: vi.fn(),
      ...overrides,
    }
  }

  function createRuntime({
    history,
  }: {
    history?: ResourceHistory
  } = {}) {
    const runtime = createTestWorkspaceRuntime({ fileSession: createFileSessionSource(), history })
    const { filesystem } = runtime

    return {
      navigation: {
        current: runtime.navigation.current,
        openExternalUrl: runtime.navigation.openExternalUrl,
        openItem: runtime.navigation.openItem,
      },
      filesystem: {
        catalog: {
          getKnownItemById: filesystem.catalog.getKnownItemById,
          getTrashedChildren: filesystem.catalog.getTrashedChildren,
          getVisibleAncestors: filesystem.catalog.getVisibleAncestors,
          getVisibleChildren: filesystem.catalog.getVisibleChildren,
          getVisibleItemById: filesystem.catalog.getVisibleItemById,
          getVisibleRoots: filesystem.catalog.getVisibleRoots,
          queryVisibleItems: filesystem.catalog.queryVisibleItems,
        },
        history: filesystem.history,
        load: {
          activeError: filesystem.load.activeError,
          activeStatus: filesystem.load.activeStatus,
          trashStatus: filesystem.load.trashStatus,
        },
        operationItems: filesystem.operationItems,
        operations: {
          createItem: filesystem.operations.createItem,
          importFile: filesystem.operations.importFile,
          validateCreateItem: filesystem.operations.validateCreateItem,
        },
        paths: {
          getVisibleItemLinkPath: filesystem.paths.getVisibleItemLinkPath,
          resolveVisibleFolderPath: filesystem.paths.resolveVisibleFolderPath,
          resolveVisibleItemPath: filesystem.paths.resolveVisibleItemPath,
          resolveVisibleNotePath: filesystem.paths.resolveVisibleNotePath,
        },
        permissions: {
          canAccessItem: filesystem.permissions.canAccessItem,
          canCreateItems: filesystem.permissions.canCreateItems,
          canEdit: filesystem.permissions.canEdit,
          canMutateItem: filesystem.permissions.canMutateItem,
          getMemberItemPermissionLevel: filesystem.permissions.getMemberItemPermissionLevel,
          workspaceMode: filesystem.permissions.workspaceMode,
        },
        sharing: {
          blocks: filesystem.sharing.blocks,
          items: filesystem.sharing.items,
          viewAsParticipant: filesystem.sharing.viewAsParticipant,
        },
      },
      sessions: {
        canvas: runtime.sessions.canvas,
        canvasEmbedded: runtime.sessions.canvasEmbedded,
        canvasPreviewUpload: runtime.sessions.canvasPreviewUpload,
        file: runtime.sessions.file,
        map: runtime.sessions.map,
        note: runtime.sessions.note,
        noteHeadings: runtime.sessions.noteHeadings,
        notePlayback: runtime.sessions.notePlayback,
        noteValues: runtime.sessions.noteValues,
      },
    }
  }

  function createFileSessionSource(): FileSession {
    return {
      replaceFile: ({ fileId }) => ({
        status: 'completed',
        receipt: { kind: 'fileReplaced', itemId: fileId, affectedCount: 1 },
      }),
      resolveFile: (file) => {
        if (file.downloadUrl) {
          return {
            allowObjectUrl: false,
            contentType: file.contentType,
            downloadUrl: file.downloadUrl,
            name: file.name,
            size: null,
            status: 'available',
          }
        }
        if (file.assetId) {
          return {
            allowObjectUrl: false,
            contentType: file.contentType,
            downloadUrl: null,
            name: file.name,
            reason: 'missing',
            size: null,
            status: 'unavailable',
          }
        }
        return {
          allowObjectUrl: false,
          contentType: file.contentType,
          downloadUrl: null,
          name: file.name,
          size: null,
          status: 'unattached',
        }
      },
    }
  }

  function renderWithSidebarReveal(ui: ReactElement) {
    return render(withSidebarReveal(ui))
  }

  function withSidebarReveal(ui: ReactElement) {
    return (
      <WorkspaceSidebarRevealProvider showItemInSidebar={vi.fn()}>
        {ui}
      </WorkspaceSidebarRevealProvider>
    )
  }
})
