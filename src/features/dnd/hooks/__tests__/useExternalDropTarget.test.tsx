import { render, screen } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useExternalDropTarget } from '../useExternalDropTarget'

const dropTargetForExternal = vi.hoisted(() => vi.fn((_args: unknown) => vi.fn()))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  dropTargetForExternal: (args: unknown) => dropTargetForExternal(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles: () => true,
}))

function ExternalDropTargetWithStoppingChild() {
  const dropTargetRef = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLDivElement>(null)

  useExternalDropTarget({
    ref: dropTargetRef,
    data: { parentId: null },
    canAcceptFiles: true,
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
    <div ref={dropTargetRef} data-testid="drop-target">
      <div ref={childRef} data-testid="stopping-child" />
    </div>
  )
}

describe('useExternalDropTarget', () => {
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
})
