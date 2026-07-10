import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { MapPinId } from '../../../../../../shared/common/ids'
import { MapPinsLayer } from '../map-pins-layer'
import { createMapPinFixture, createNoteFixture, testId } from './test-fixtures'

describe('MapPinsLayer', () => {
  it('starts a move-mode pin drag after the touch pointer moves and captures the pointer', () => {
    const pin = createMapPinFixture()
    const onDragStart: NonNullable<ComponentProps<typeof MapPinsLayer>['onDragStart']> = vi.fn()

    render(
      <MapPinsLayer
        pins={[pin]}
        isPinGhost={() => false}
        moveModePinId={pin.id}
        interactive
        onDragStart={onDragStart}
      />,
    )

    const pinButton = screen.getByRole('button', { name: 'Note' })
    const setPointerCapture = vi.fn()
    pinButton.setPointerCapture = setPointerCapture

    fireEvent.pointerDown(pinButton, {
      pointerId: 17,
      pointerType: 'touch',
      button: 0,
      clientX: 10,
      clientY: 10,
    })

    expect(onDragStart).not.toHaveBeenCalled()

    fireEvent.pointerMove(pinButton, {
      pointerId: 17,
      pointerType: 'touch',
      clientX: 16,
      clientY: 10,
    })

    expect(onDragStart).toHaveBeenCalledExactlyOnceWith(expect.any(Object), pin)
    expect(setPointerCapture).toHaveBeenCalledExactlyOnceWith(17)
  })

  it('stops map propagation before activating a pin', () => {
    const pin = createMapPinFixture()
    const onPinClick: NonNullable<ComponentProps<typeof MapPinsLayer>['onClick']> = vi.fn(
      (event, clickedPin) => {
        expect(event.defaultPrevented).toBe(true)
        expect(event.isPropagationStopped()).toBe(true)
        expect(clickedPin).toBe(pin)
      },
    )

    render(<MapPinsLayer pins={[pin]} isPinGhost={() => false} interactive onClick={onPinClick} />)

    fireEvent.click(screen.getByRole('button', { name: 'Note' }))

    expect(onPinClick).toHaveBeenCalledOnce()
  })

  it('lets native button activation own keyboard clicks', async () => {
    const user = userEvent.setup()
    const pin = createMapPinFixture()
    const onPinClick: NonNullable<ComponentProps<typeof MapPinsLayer>['onClick']> = vi.fn()

    render(<MapPinsLayer pins={[pin]} isPinGhost={() => false} interactive onClick={onPinClick} />)

    const pinButton = screen.getByRole('button', { name: 'Note' })
    pinButton.focus()
    await user.keyboard('{Enter}')

    expect(onPinClick).toHaveBeenCalledOnce()
  })

  it('opens the pin action menu from the keyboard context-menu command', () => {
    const pin = createMapPinFixture()
    const onContextMenu: NonNullable<ComponentProps<typeof MapPinsLayer>['onContextMenu']> = vi.fn(
      (event, contextPin) => {
        expect(event.defaultPrevented).toBe(true)
        expect(event.isPropagationStopped()).toBe(true)
        expect(contextPin).toBe(pin)
      },
    )

    render(
      <MapPinsLayer
        pins={[pin]}
        isPinGhost={() => false}
        interactive
        onContextMenu={onContextMenu}
      />,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Note' }), {
      key: 'ContextMenu',
    })

    expect(onContextMenu).toHaveBeenCalledOnce()
  })

  it('derives presentation for visible, hidden, and ghost pins', () => {
    const visiblePin = createMapPinFixture({
      item: createNoteFixture({ color: '#125599' }),
    })
    const hiddenPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-2'),
      item: createNoteFixture({ name: 'Secret Door' }),
      visible: false,
    })
    const ghostPin = createMapPinFixture({
      id: testId<MapPinId>('map-pin-3'),
      item: createNoteFixture({ name: 'Hidden Note' }),
    })

    render(
      <MapPinsLayer
        pins={[visiblePin, hiddenPin, ghostPin]}
        isPinGhost={(pin) => pin.id === ghostPin.id}
        interactive
      />,
    )

    expect(screen.getByRole('button', { name: 'Note' }).querySelector('path')).toHaveAttribute(
      'fill',
      '#125599',
    )
    expect(screen.getByRole('button', { name: 'Secret Door (hidden)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '???' }).querySelector('path')).toHaveAttribute(
      'fill',
      'var(--map-pin-ghost)',
    )
  })
})
