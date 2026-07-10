import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useDroppable } from '../use-droppable'

const elementDropTargets = vi.hoisted(() => {
  const cleanups: Array<ReturnType<typeof vi.fn>> = []
  return {
    cleanups,
    dropTargetForElements: vi.fn((_args: unknown) => {
      const cleanup = vi.fn()
      cleanups.push(cleanup)
      return cleanup
    }),
  }
})

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  dropTargetForElements: (args: unknown) => elementDropTargets.dropTargetForElements(args),
}))

function SwappingDroppable() {
  const [target, setTarget] = useState<'first' | 'second'>('first')

  const { droppableRef } = useDroppable({
    data: { target },
  })

  return (
    <>
      <button type="button" onClick={() => setTarget('second')}>
        swap target
      </button>
      {target === 'first' ? (
        <div key="first" ref={droppableRef} data-testid="first-target" />
      ) : (
        <div key="second" ref={droppableRef} data-testid="second-target" />
      )}
    </>
  )
}

function CallbackDroppable({
  canDrop,
  data = { target: 'first' },
}: {
  canDrop?: (sourceData: unknown) => boolean
  data?: Record<string, unknown>
}) {
  const { droppableRef } = useDroppable({
    data,
    canDrop,
  })

  return <div ref={droppableRef} data-testid="callback-target" />
}

describe('useDroppable', () => {
  beforeEach(() => {
    elementDropTargets.dropTargetForElements.mockClear()
    elementDropTargets.cleanups.length = 0
  })

  it('rebinds the element drop target when the ref element changes', () => {
    render(<SwappingDroppable />)

    fireEvent.click(screen.getByRole('button', { name: 'swap target' }))

    const secondTarget = screen.getByTestId('second-target')
    const latestRegistration = elementDropTargets.dropTargetForElements.mock.calls.at(-1)?.[0]

    expect(elementDropTargets.cleanups[0]).toHaveBeenCalledOnce()
    expect(latestRegistration).toEqual(expect.objectContaining({ element: secondTarget }))
  })

  it('passes current data through registered drop callbacks', () => {
    const { rerender } = render(<CallbackDroppable data={{ target: 'first' }} />)

    let registration = elementDropTargets.dropTargetForElements.mock.calls.at(-1)?.[0] as {
      getData: () => Record<string, unknown>
      canDrop: (args: { source: { data: Record<string, unknown> } }) => boolean
    }
    expect(registration.getData()).toEqual({ target: 'first' })
    expect(registration.canDrop({ source: { data: { item: 'note' } } })).toBe(true)

    rerender(<CallbackDroppable data={{ target: 'second' }} />)

    registration = elementDropTargets.dropTargetForElements.mock.calls.at(-1)?.[0] as {
      getData: () => Record<string, unknown>
      canDrop: (args: { source: { data: Record<string, unknown> } }) => boolean
    }
    expect(registration.getData()).toEqual({ target: 'second' })
  })

  it('delegates source data to the optional canDrop callback', () => {
    const canDrop = vi.fn((sourceData) => sourceData === 'allowed')
    render(<CallbackDroppable canDrop={canDrop} />)

    const registration = elementDropTargets.dropTargetForElements.mock.calls.at(-1)?.[0] as {
      canDrop: (args: { source: { data: unknown } }) => boolean
    }

    expect(registration.canDrop({ source: { data: 'allowed' } })).toBe(true)
    expect(registration.canDrop({ source: { data: 'blocked' } })).toBe(false)
    expect(canDrop).toHaveBeenCalledWith('allowed')
    expect(canDrop).toHaveBeenCalledWith('blocked')
  })
})
