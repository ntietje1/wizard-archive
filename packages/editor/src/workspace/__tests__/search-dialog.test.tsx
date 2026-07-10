import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WorkspaceRuntimeSearchDialog } from '../search-dialog'
import { WorkspaceRuntimeSearchRequestProvider } from '../search-request-provider'
import type { SearchDialogController } from '../../search/dialog-controller'
import type { FileSystemSearch } from '../../filesystem/search'
import { createNote } from '../../test/sidebar-item-factory'
import { createWorkspaceResource } from '../runtime'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'
import type { EmbeddedNoteContentSource } from '../../notes/runtime'
import type {
  ResourceContentSource,
  ResourceContentState,
} from '../../filesystem/resource-content-source'

const SearchDialogSpy = vi.hoisted(() => vi.fn())

vi.mock('../../search/dialog', () => ({
  SearchDialog: ({
    controller,
    embeddedNoteContentSource,
    previewState,
  }: {
    controller: SearchDialogController
    embeddedNoteContentSource: EmbeddedNoteContentSource
    previewState: ResourceContentState
  }) => {
    SearchDialogSpy({ controller, embeddedNoteContentSource, previewState })
    return (
      <div
        data-testid="runtime-search-dialog"
        data-results={String(controller.displayItems.length)}
        data-empty={controller.emptyStateMessage ?? ''}
        data-inline={controller.inlineStatusMessage ?? ''}
        data-open={String(controller.isOpen)}
        data-query={controller.query}
        data-selected-content={previewState.status === 'ready' ? previewState.item.name : ''}
        data-status={controller.status}
      >
        <button type="button" onClick={() => controller.setQuery('new note')}>
          Set new note query
        </button>
      </div>
    )
  },
}))

describe('WorkspaceRuntimeSearchDialog', () => {
  beforeEach(() => {
    SearchDialogSpy.mockReset()
  })

  it('renders the shared search dialog from source-provided state', () => {
    const note = {
      ...createNote({ name: 'Lantern Market' }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [],
    }
    const previewState = {
      status: 'ready',
      label: note.name,
      error: null,
      folderChildren: [],
      isLoading: false,
      item: note,
    } satisfies ResourceContentState
    const ensureContentState = vi.fn()
    const ensureSearchState = vi.fn()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      operations: { createItem: vi.fn() },
      resourceContent: createAvailableResourceContent({
        ensureContentState,
        getContentState: () => previewState,
      }),
      search: createAvailableSearch({
        ensureSearchState,
        getSearchState: () => ({
          bodySearchError: null,
          bodySearchPending: false,
          recentItems: [
            {
              breadcrumb: '',
              item: note,
              itemId: note.id,
              resource: createWorkspaceResource(note.id),
              matchText: null,
              matchType: 'title' as const,
            },
          ],
          results: [],
        }),
      }),
    })

    render(<WorkspaceRuntimeSearchDialog runtime={runtime} />)

    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute('data-results', '1')
    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute(
      'data-selected-content',
      'Lantern Market',
    )
    expect(ensureSearchState).toHaveBeenCalledWith({ query: '' })
    expect(ensureContentState).toHaveBeenCalledWith(note.id)
    expect(SearchDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddedNoteContentSource: expect.objectContaining({
          getEmbeddedNoteContent: expect.any(Function),
        }),
      }),
    )
  })

  it('renders an unavailable dialog when runtime search is unsupported', () => {
    const runtime = createTestWorkspaceRuntime({
      operations: { createItem: vi.fn() },
      resourceContent: createUnsupportedResourceContent(),
      search: {
        status: 'unsupported' as const,
        reason: 'not_implemented' as const,
      },
    })

    render(<WorkspaceRuntimeSearchDialog runtime={runtime} />)

    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute(
      'data-status',
      'Search unavailable',
    )
    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute(
      'data-empty',
      'Search is not available in this workspace.',
    )
  })

  it('keeps creation commands available when runtime search is unsupported', async () => {
    const runtime = createTestWorkspaceRuntime({
      operations: { createItem: vi.fn() },
      resourceContent: createUnsupportedResourceContent(),
      search: {
        status: 'unsupported' as const,
        reason: 'not_implemented' as const,
      },
    })

    render(<WorkspaceRuntimeSearchDialog runtime={runtime} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set new note query' }))

    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute('data-query', 'new note')
    await waitFor(() => {
      expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute('data-results', '1')
    })
    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute(
      'data-inline',
      'Search is unavailable. Showing commands only.',
    )
    expect(screen.getByTestId('runtime-search-dialog')).toHaveAttribute('data-empty', '')
  })

  it('scopes keyboard search requests to the focused runtime', async () => {
    const firstScope = createRef<HTMLDivElement>()
    const secondScope = createRef<HTMLDivElement>()
    const firstRuntime = createRuntimeSearchDialogTestRuntime()
    const secondRuntime = createRuntimeSearchDialogTestRuntime()

    render(
      <>
        <WorkspaceRuntimeSearchRequestProvider scopeRef={firstScope}>
          <div ref={firstScope}>
            <button type="button">First runtime</button>
            <WorkspaceRuntimeSearchDialog runtime={firstRuntime} />
          </div>
        </WorkspaceRuntimeSearchRequestProvider>
        <WorkspaceRuntimeSearchRequestProvider scopeRef={secondScope}>
          <div ref={secondScope}>
            <button type="button">Second runtime</button>
            <WorkspaceRuntimeSearchDialog runtime={secondRuntime} />
          </div>
        </WorkspaceRuntimeSearchRequestProvider>
      </>,
    )

    screen.getByRole('button', { name: 'First runtime' }).focus()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getAllByTestId('runtime-search-dialog')[0]).toHaveAttribute('data-open', 'true')
    })
    expect(screen.getAllByTestId('runtime-search-dialog')[1]).toHaveAttribute('data-open', 'false')
  })
})

function createRuntimeSearchDialogTestRuntime() {
  return createTestWorkspaceRuntime({
    operations: { createItem: vi.fn() },
    resourceContent: createAvailableResourceContent(),
    search: createAvailableSearch({
      ensureSearchState: vi.fn(),
      getSearchState: () => ({
        bodySearchError: null,
        bodySearchPending: false,
        recentItems: [],
        results: [],
      }),
    }),
  })
}

function createAvailableSearch(
  overrides: Partial<Extract<FileSystemSearch, { status: 'available' }>> = {},
): Extract<FileSystemSearch, { status: 'available' }> {
  return {
    status: 'available',
    ensureSearchState: vi.fn(),
    getSearchState: () => ({
      bodySearchError: null,
      bodySearchPending: false,
      recentItems: [],
      results: [],
    }),
    itemLinks: { status: 'unsupported', reason: 'not_available' },
    ...overrides,
  }
}

function createUnsupportedResourceContent(): ResourceContentSource {
  return { status: 'unsupported', reason: 'not_available' }
}

function createAvailableResourceContent(
  overrides: Partial<Extract<ResourceContentSource, { status: 'available' }>> = {},
): Extract<ResourceContentSource, { status: 'available' }> {
  return {
    status: 'available',
    ensureContentState: vi.fn(),
    getContentState: () => ({
      status: 'not_found',
      label: 'Page',
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
    }),
    resolveItem: () => null,
    ...overrides,
  }
}
