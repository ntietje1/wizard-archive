import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { NoteItemWithContent } from '../../../notes/item-contract'
import { createNote } from '../../../test/sidebar-item-factory'
import type { BlocksShareSource, BlocksShareState } from '../../contracts'
import { BlockShareMenuProvider } from '../menu'
import { useBlockShareMenu } from '../use-menu'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BlockShareMenuProvider', () => {
  it('renders a block share menu when sharing is available', () => {
    render(
      <BlockShareMenuProvider blockSharing={createAvailableBlockSharing()}>
        <OpenBlockShareMenuButton />
      </BlockShareMenuProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open block share' }))

    expect(screen.getByTestId('block-share-menu')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Share Block' })).toBeInstanceOf(HTMLDialogElement)
  })

  it('does not render a fake block share menu when sharing is unsupported', () => {
    render(
      <BlockShareMenuProvider blockSharing={{ status: 'unsupported', reason: 'not_available' }}>
        <OpenBlockShareMenuButton />
      </BlockShareMenuProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open block share' }))

    expect(screen.queryByTestId('block-share-menu')).not.toBeInTheDocument()
  })

  it('measures the menu when sharing becomes ready after opening', () => {
    const observeElement = vi.fn()
    class ResizeObserverMock {
      disconnect = vi.fn()
      observe = observeElement
      unobserve = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)

    render(<TransitioningBlockShareMenu />)

    fireEvent.click(screen.getByRole('button', { name: 'Open block share' }))
    expect(screen.queryByTestId('block-share-menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Make sharing ready' }))

    expect(screen.getByTestId('block-share-menu')).toBeInTheDocument()
    expect(observeElement).toHaveBeenCalledExactlyOnceWith(expect.any(HTMLDialogElement))
  })
})

function TransitioningBlockShareMenu() {
  const [isReady, setIsReady] = useState(false)
  const blockSharing: BlocksShareSource = {
    status: 'available',
    useBlocksShare: () => (isReady ? createReadyShareState() : createLoadingShareState()),
  }

  return (
    <BlockShareMenuProvider blockSharing={blockSharing}>
      <OpenBlockShareMenuButton />
      <button type="button" onClick={() => setIsReady(true)}>
        Make sharing ready
      </button>
    </BlockShareMenuProvider>
  )
}

function OpenBlockShareMenuButton() {
  const blockShareMenu = useBlockShareMenu()
  return (
    <button
      type="button"
      onClick={() =>
        blockShareMenu.open({
          blocks: [{ id: 'block-1' }],
          note: createNoteWithContent(),
          position: { x: 0, y: 0 },
          title: 'Share Block',
        })
      }
    >
      Open block share
    </button>
  )
}

function createAvailableBlockSharing(): BlocksShareSource {
  const shareState = createReadyShareState()
  return {
    status: 'available',
    useBlocksShare: () => shareState,
  }
}

function createLoadingShareState(): BlocksShareState {
  return {
    status: 'loading',
    isMutating: false,
    aggregateShareStatus: 'not_shared',
    defaultPermissionLevel: 'hidden',
    shareItems: [],
  }
}

function createReadyShareState(): BlocksShareState {
  const completedShareAction = () => Promise.resolve({ status: 'completed' as const })
  return {
    status: 'ready',
    isMutating: false,
    aggregateShareStatus: 'not_shared',
    defaultPermissionLevel: 'hidden',
    shareItems: [],
    toggleShareStatus: vi.fn(completedShareAction),
    setDefaultPermission: vi.fn(completedShareAction),
    setParticipantPermission: vi.fn(completedShareAction),
  }
}

function createNoteWithContent(): NoteItemWithContent {
  return {
    ...createNote({ name: 'Shared Note' }),
    ancestors: [],
    content: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
  } as NoteItemWithContent
}
