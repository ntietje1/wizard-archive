import { describe, expect, it } from 'vitest'
import { getNextBlockTypeMenuState } from '../formatting-toolbar-state'

describe('getNextBlockTypeMenuState', () => {
  it('keeps the menu open through the click that follows a trigger press open', () => {
    const opened = getNextBlockTypeMenuState({
      ignoreOpeningClickClose: false,
      nextOpen: true,
      details: { event: new PointerEvent('pointerdown'), reason: 'trigger-press' },
    })

    expect(opened).toEqual({ open: true, ignoreOpeningClickClose: true })
    expect(
      getNextBlockTypeMenuState({
        ignoreOpeningClickClose: opened.ignoreOpeningClickClose,
        nextOpen: false,
        details: { event: new MouseEvent('click'), reason: 'trigger-press' },
      }),
    ).toEqual({ open: true, ignoreOpeningClickClose: false })
  })

  it('opens without ignoring later closes for non-press reasons', () => {
    expect(
      getNextBlockTypeMenuState({
        ignoreOpeningClickClose: false,
        nextOpen: true,
        details: { event: new KeyboardEvent('keydown'), reason: 'keyboard' },
      }),
    ).toEqual({ open: true, ignoreOpeningClickClose: false })
  })

  it('closes when there is no opening click to swallow', () => {
    expect(
      getNextBlockTypeMenuState({
        ignoreOpeningClickClose: false,
        nextOpen: false,
        details: { event: new MouseEvent('click'), reason: 'trigger-press' },
      }),
    ).toEqual({ open: false, ignoreOpeningClickClose: false })
  })

  it('closes on non-click and non-trigger close requests', () => {
    expect(
      getNextBlockTypeMenuState({
        ignoreOpeningClickClose: true,
        nextOpen: false,
        details: { event: new PointerEvent('pointerdown'), reason: 'trigger-press' },
      }),
    ).toEqual({ open: false, ignoreOpeningClickClose: false })

    expect(
      getNextBlockTypeMenuState({
        ignoreOpeningClickClose: true,
        nextOpen: false,
        details: { event: new MouseEvent('click'), reason: 'escape-key' },
      }),
    ).toEqual({ open: false, ignoreOpeningClickClose: false })
  })
})
