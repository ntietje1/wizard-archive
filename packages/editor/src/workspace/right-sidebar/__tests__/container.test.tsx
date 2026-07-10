import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { RIGHT_SIDEBAR_CONTENT } from '../content'
import type { RightSidebarContentId } from '../content'
import { createRuntimeRightSidebarSource } from '../runtime-source'
import type { RightSidebarSource } from '../source'
import type { AnyItem } from '../../items'
import type { ResourceHistory } from '../../../filesystem/history-types'
import { createFile, createNote } from '../../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { RightSidebarContainer } from '../container'

vi.mock('@wizard-archive/ui/components/resizable-sidebar', () => ({
  ResizableSidebar: ({ children }: { children: ReactNode }) => (
    <div data-testid="resizable-sidebar">{children}</div>
  ),
}))

class IntersectionObserverStub {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('RightSidebarContainer', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the history sidebar for file items', () => {
    const file = createFile()
    const sidebarState = createSidebarState({
      activeContentId: RIGHT_SIDEBAR_CONTENT.history,
      visible: true,
    })

    render(
      <RightSidebarContainer
        item={file}
        sidebar={sidebarState}
        source={createRightSidebarSource(file)}
      />,
    )

    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('history-panel')).toHaveTextContent('No history yet.')
  })

  it('renders the fallback panel as selected when stored active panel is unavailable', () => {
    const note = createNote()
    const sidebarState = createSidebarState({
      activeContentId: RIGHT_SIDEBAR_CONTENT.history,
      visible: true,
    })

    render(
      <RightSidebarContainer
        item={note}
        sidebar={sidebarState}
        source={createRightSidebarSource(note, {
          history: { status: 'unavailable' },
          itemLinks: { status: 'unsupported', reason: 'not_available' },
        })}
      />,
    )

    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outline' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides the sidebar when the current item has no available panels', () => {
    const file = createFile()
    const sidebarState = createSidebarState({
      activeContentId: RIGHT_SIDEBAR_CONTENT.history,
      visible: true,
    })

    render(
      <RightSidebarContainer
        item={file}
        sidebar={sidebarState}
        source={createRightSidebarSource(file, {
          history: { status: 'unavailable' },
          itemLinks: { status: 'unsupported', reason: 'not_available' },
        })}
      />,
    )

    expect(screen.queryByTestId('resizable-sidebar')).not.toBeInTheDocument()
  })
})

function createSidebarState(
  overrides: Partial<{
    activeContentId: RightSidebarContentId
    visible: boolean
  }> = {},
) {
  return {
    visible: true,
    activeContentId: RIGHT_SIDEBAR_CONTENT.history,
    size: 300,
    isLoaded: true,
    setSize: vi.fn(),
    setVisible: vi.fn(),
    setActiveContent: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    ...overrides,
  }
}

function createRightSidebarSource(
  item: AnyItem,
  overrides: Partial<Pick<RightSidebarSource, 'history' | 'itemLinks'>> = {},
): RightSidebarSource {
  return {
    ...createRuntimeRightSidebarSource(
      createTestWorkspaceRuntime({
        history: createAvailableHistory(item),
        item,
      }),
      { navigateToHeading: vi.fn() },
    ),
    ...overrides,
  }
}

function createAvailableHistory(item: AnyItem): Extract<ResourceHistory, { status: 'available' }> {
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
    preview: { status: 'unavailable', entryTime: undefined },
    previewingEntryId: null,
    previewEntry: vi.fn(),
    rollbackEntryId: null,
    rollback: { status: 'closed', isRestoring: false },
    requestRollback: vi.fn(),
    restoreRollback: vi.fn(),
    clearPreview: vi.fn(),
    clearRollback: vi.fn(),
    clearItemSession: vi.fn(),
  }
}
