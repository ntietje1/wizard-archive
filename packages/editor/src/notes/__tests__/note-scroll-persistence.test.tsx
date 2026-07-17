import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { EPHEMERAL_NOTE_SCROLL, useNoteScrollPersistence } from '../note-scroll-persistence'

const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
const behavior = { kind: 'persistent', campaignId, resourceId } as const
const storageKey = `wizard-editor-view-state:${campaignId}:note-scroll:${resourceId}`

describe('useNoteScrollPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('restores the reference browser view-state key when the viewport attaches', () => {
    const viewport = document.createElement('div')
    window.localStorage.setItem(storageKey, JSON.stringify(240))
    const { rerender } = renderHook(
      ({ element }: { element: HTMLDivElement | null }) =>
        useNoteScrollPersistence(behavior, element),
      { initialProps: { element: null as HTMLDivElement | null } },
    )

    rerender({ element: viewport })

    expect(viewport.scrollTop).toBe(240)
  })

  it('saves the current position after scrolling', () => {
    vi.useFakeTimers()
    const viewport = document.createElement('div')
    renderHook(() => useNoteScrollPersistence(behavior, viewport))

    act(() => {
      viewport.scrollTop = 180
      viewport.dispatchEvent(new Event('scroll'))
      vi.advanceTimersByTime(150)
    })

    expect(window.localStorage.getItem(storageKey)).toBe('180')
  })

  it('leaves embedded note surfaces ephemeral', () => {
    const viewport = document.createElement('div')
    renderHook(() => useNoteScrollPersistence(EPHEMERAL_NOTE_SCROLL, viewport))

    viewport.scrollTop = 96
    viewport.dispatchEvent(new Event('scroll'))

    expect(window.localStorage.length).toBe(0)
  })
})
