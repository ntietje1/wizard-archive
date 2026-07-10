import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useExternalDropTarget } from '../use-external-drop-target'
import type { ExternalFileDropTargetCapability } from '../external-file-drop-target'

const externalDropTargets = vi.hoisted(() => {
  const cleanups: Array<ReturnType<typeof vi.fn>> = []
  return {
    cleanups,
    dropTargetForExternal: vi.fn((_args: unknown) => {
      const cleanup = vi.fn()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
})

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  dropTargetForExternal: (args: unknown) => externalDropTargets.dropTargetForExternal(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles: () => true,
}))

function ExternalDropTargetWithStoppingChild() {
  const childRef = useRef<HTMLDivElement>(null)

  const { externalDropTargetRef } = useExternalDropTarget({
    data: { parentId: null },
    enabled: true,
    fileDropTarget: acceptedExternalFiles(),
  })

  useEffect(() => {
    const child = childRef.current
    if (!child) return

    const stopPropagation = (event: DragEvent) => {
      event.stopPropagation()
    }
    child.addEventListener('dragover', stopPropagation, true)
    return () => child.removeEventListener('dragover', stopPropagation, true)
  }, [])

  return (
    <div ref={externalDropTargetRef} data-testid="drop-target">
      <div ref={childRef} data-testid="stopping-child" />
    </div>
  )
}

function ExternalDropTargetWithBlockedChild() {
  const { externalDropTargetRef } = useExternalDropTarget({
    data: { parentId: null },
    enabled: true,
    fileDropTarget: acceptedExternalFiles(),
    blockedTargetSelector: '[data-blocked-external-drop="true"]',
  })

  return (
    <div ref={externalDropTargetRef} data-testid="drop-target">
      <div data-blocked-external-drop="true" data-testid="blocked-child" />
    </div>
  )
}

function SwappingExternalDropTarget() {
  const [target, setTarget] = useState<'first' | 'second'>('first')

  const { externalDropTargetRef } = useExternalDropTarget({
    data: { target },
    enabled: true,
    fileDropTarget: acceptedExternalFiles(),
  })

  return (
    <>
      <button type="button" onClick={() => setTarget('second')}>
        swap target
      </button>
      {target === 'first' ? (
        <div key="first" ref={externalDropTargetRef} data-testid="first-target" />
      ) : (
        <div key="second" ref={externalDropTargetRef} data-testid="second-target" />
      )}
    </>
  )
}

function ExternalCallbackTarget({
  enabled,
  data,
}: {
  enabled: boolean
  data: Record<string, unknown>
}) {
  const { externalDropTargetRef, isFileDropTarget } = useExternalDropTarget({
    data,
    enabled,
    fileDropTarget: acceptedExternalFiles(),
  })

  return (
    <div ref={externalDropTargetRef} data-file-target={isFileDropTarget} data-testid="target" />
  )
}

describe('useExternalDropTarget', () => {
  beforeEach(() => {
    externalDropTargets.dropTargetForExternal.mockClear()
    externalDropTargets.cleanups.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an accepted file drop cursor even when an editor child stops propagation', () => {
    render(<ExternalDropTargetWithStoppingChild />)

    const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    const dataTransfer = {
      types: ['Files'],
      dropEffect: 'none',
    }
    Object.defineProperty(event, 'dataTransfer', {
      value: dataTransfer,
    })

    screen.getByTestId('stopping-child').dispatchEvent(event)

    expect(dataTransfer.dropEffect).toBe('copy')
  })

  it('rejects file drops from blocked descendants of the external target', () => {
    render(<ExternalDropTargetWithBlockedChild />)

    const blockedChild = screen.getByTestId('blocked-child')
    mockElementFromPoint(blockedChild)

    const registration = externalDropTargets.dropTargetForExternal.mock.calls.at(-1)?.[0] as {
      canDrop: (args: { source: unknown; input: { clientX: number; clientY: number } }) => boolean
    }

    expect(
      registration.canDrop({
        source: {},
        input: { clientX: 10, clientY: 20 },
      }),
    ).toBe(false)

    const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    const dataTransfer = {
      types: ['Files'],
      dropEffect: 'none',
    }
    Object.defineProperty(event, 'dataTransfer', {
      value: dataTransfer,
    })

    blockedChild.dispatchEvent(event)

    expect(dataTransfer.dropEffect).toBe('none')
  })

  it('accepts file drops outside blocked descendants', () => {
    render(<ExternalDropTargetWithBlockedChild />)

    const dropTarget = screen.getByTestId('drop-target')
    mockElementFromPoint(dropTarget)

    const registration = externalDropTargets.dropTargetForExternal.mock.calls.at(-1)?.[0] as {
      canDrop: (args: { source: unknown; input: { clientX: number; clientY: number } }) => boolean
    }

    expect(
      registration.canDrop({
        source: {},
        input: { clientX: 10, clientY: 20 },
      }),
    ).toBe(true)
  })

  it('rebinds the external file drop target when the ref element changes', () => {
    render(<SwappingExternalDropTarget />)

    fireEvent.click(screen.getByRole('button', { name: 'swap target' }))

    const secondTarget = screen.getByTestId('second-target')
    const latestRegistration = externalDropTargets.dropTargetForExternal.mock.calls.at(-1)?.[0]

    expect(externalDropTargets.cleanups[0]).toHaveBeenCalledOnce()
    expect(latestRegistration).toEqual(expect.objectContaining({ element: secondTarget }))

    const event = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent
    const dataTransfer = {
      types: ['Files'],
      dropEffect: 'none',
    }
    Object.defineProperty(event, 'dataTransfer', {
      value: dataTransfer,
    })

    secondTarget.dispatchEvent(event)

    expect(dataTransfer.dropEffect).toBe('copy')
  })

  it('exposes current data and hover state through registered external callbacks', () => {
    const { rerender } = render(
      <ExternalCallbackTarget enabled={true} data={{ parentId: 'first' }} />,
    )

    let registration = externalDropTargets.dropTargetForExternal.mock.calls.at(-1)?.[0] as {
      getData: () => Record<string, unknown>
      canDrop: (args: { source: unknown }) => boolean
      onDragEnter: () => void
      onDragLeave: () => void
      onDrop: () => void
    }

    expect(registration.getData()).toEqual({ parentId: 'first' })
    expect(registration.canDrop({ source: {} })).toBe(true)

    act(() => {
      registration.onDragEnter()
    })
    expect(screen.getByTestId('target')).toHaveAttribute('data-file-target', 'true')

    act(() => {
      registration.onDragLeave()
    })
    expect(screen.getByTestId('target')).toHaveAttribute('data-file-target', 'false')

    act(() => {
      registration.onDragEnter()
    })
    act(() => {
      registration.onDrop()
    })
    expect(screen.getByTestId('target')).toHaveAttribute('data-file-target', 'false')

    rerender(<ExternalCallbackTarget enabled={true} data={{ parentId: 'second' }} />)

    const latestRegistration = externalDropTargets.dropTargetForExternal.mock.calls.at(-1)?.[0] as {
      getData: () => Record<string, unknown>
    }
    expect(latestRegistration.getData()).toEqual({ parentId: 'second' })
  })

  it('skips external drop target registration when file drops are not accepted', () => {
    render(<ExternalCallbackTarget enabled={false} data={{ parentId: 'disabled' }} />)

    expect(externalDropTargets.dropTargetForExternal).not.toHaveBeenCalled()
    expect(screen.getByTestId('target')).toHaveAttribute('data-file-target', 'false')
  })
})

function acceptedExternalFiles(): ExternalFileDropTargetCapability {
  return {
    kind: 'accepted',
    files: { kind: 'fileImport', destination: { kind: 'assets' } },
    browserFolders: { kind: 'fileImport', destination: { kind: 'assets' } },
  }
}

function mockElementFromPoint(element: Element) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => element),
  })
}
