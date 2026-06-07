import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import {
  INITIAL_DEMO_WORKSPACE,
  noteBodyToBlocks,
} from '~/features/landing/demo-workspace/demo-workspace-model'
import { DemoWorkspace } from '../demo-workspace'
import HeroProductDemoIsland from '../hero-product-demo-island'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'shared/editor-blocks/types'

vi.mock('~/features/editor/components/viewer/file/file-content-viewer', () => ({
  FileContentViewer: () => <div data-testid="runtime-file-viewer" />,
}))

const resizeObservers: Array<MockResizeObserver> = []
let animationFrameCallbacks: Array<FrameRequestCallback> = []

describe('landing demo runtime surfaces', () => {
  beforeEach(() => {
    resizeObservers.length = 0
    animationFrameCallbacks = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrameCallbacks.push(callback)
      return animationFrameCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      if (Number.isFinite(handle) && handle >= 1 && handle <= animationFrameCallbacks.length) {
        animationFrameCallbacks[handle - 1] = () => undefined
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('navigates the landing preview from note to canvas without duplicate BlockNote plugins', () => {
    render(<HeroProductDemoIsland />)

    fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))

    expect(screen.getByLabelText('Canvas preview')).toBeInTheDocument()
  })

  it('mounts raw read-only note content without duplicate BlockNote plugins', () => {
    render(
      <RawNoteContent
        editable={false}
        content={[
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: 'Preview note', styles: {} }],
            children: [],
          } satisfies CustomBlock,
        ]}
      />,
    )

    expect(screen.getByText('Preview note')).toBeInTheDocument()
  })

  it('mounts landing read-only note content without duplicate BlockNote plugins', () => {
    render(
      <RawNoteContent
        noteId={'note-market' as Id<'sidebarItems'>}
        editable={false}
        content={noteBodyToBlocks(INITIAL_DEMO_WORKSPACE.note.body)}
      />,
    )

    expect(
      screen.getByText('A waterfront bazaar where every stall hides a second ledger.'),
    ).toBeInTheDocument()
  })

  it('navigates the editable demo workspace from note to canvas without duplicate BlockNote plugins', () => {
    render(<DemoWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: 'Harbor Heist Board' }))

    expect(screen.getByLabelText('Canvas surface')).toBeInTheDocument()
  })
})

class MockResizeObserver implements ResizeObserver {
  readonly observed: Array<Element> = []

  observe(element: Element) {
    this.observed.push(element)
    resizeObservers.push(this)
  }

  unobserve(element: Element) {
    const index = this.observed.indexOf(element)
    if (index >= 0) this.observed.splice(index, 1)
  }

  disconnect() {
    this.observed.length = 0
  }
}
