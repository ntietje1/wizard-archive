import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HeroProductDemoIsland from '../hero-product-demo-island'

vi.mock('~/features/editor/components/viewer/file/file-content-viewer', () => ({
  FileContentViewer: () => <div data-testid="runtime-file-viewer" />,
}))

vi.mock('~/features/editor/components/raw-note-content', () => ({
  RawNoteContent: () => <div>A waterfront bazaar where every stall hides a second ledger.</div>,
}))

const resizeObservers: Array<MockResizeObserver> = []

describe('landing demo runtime surfaces', () => {
  beforeEach(() => {
    resizeObservers.length = 0
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
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

  it('navigates the editable demo workspace from note to canvas without duplicate BlockNote plugins', async () => {
    const { DemoWorkspace } = await import('../demo-workspace')

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
