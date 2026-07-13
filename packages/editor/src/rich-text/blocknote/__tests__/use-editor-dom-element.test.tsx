import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useEditorDomElement } from '../use-editor-dom-element'

type EditorDomElementSource = { domElement?: HTMLElement | null }

describe('useEditorDomElement', () => {
  let queuedFrames: Array<FrameRequestCallback | undefined>
  let requestAnimationFrameSpy: ReturnType<typeof vi.fn>
  let cancelAnimationFrameSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queuedFrames = []
    requestAnimationFrameSpy = vi.fn((callback: FrameRequestCallback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    cancelAnimationFrameSpy = vi.fn((id: number) => {
      queuedFrames[id - 1] = undefined
    })
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses an immediately available editor element', () => {
    const domElement = document.createElement('div')
    const { result } = renderHook(() => useEditorDomElement({ domElement }))

    expect(result.current).toBe(domElement)
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
  })

  it('polls until the editor element becomes available', () => {
    const domElement = document.createElement('div')
    const editor: { domElement?: HTMLElement | null } = { domElement: null }
    const { result } = renderHook(() => useEditorDomElement(editor))

    expect(result.current).toBeNull()
    editor.domElement = domElement

    act(() => {
      queuedFrames.shift()?.(0)
    })

    expect(result.current).toBe(domElement)
  })

  it('stops polling after the retry limit', () => {
    renderHook(() => useEditorDomElement({ domElement: null }))

    act(() => {
      for (let index = 0; index < 20; index += 1) {
        queuedFrames.shift()?.(index)
      }
    })

    expect(queuedFrames.filter(Boolean)).toHaveLength(0)
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(10)
  })

  it('does not expose the previous editor element during an editor swap', () => {
    const firstElement = document.createElement('div')
    const secondEditor = { domElement: null as HTMLElement | null }
    const { result, rerender } = renderHook(
      ({ editor }: { editor: EditorDomElementSource }) => useEditorDomElement(editor),
      { initialProps: { editor: { domElement: firstElement } as EditorDomElementSource } },
    )

    rerender({ editor: secondEditor })

    expect(result.current).toBeNull()
  })

  it('cancels polling when the editor disappears', () => {
    const { rerender } = renderHook(
      ({ editor }: { editor: EditorDomElementSource | undefined }) => useEditorDomElement(editor),
      { initialProps: { editor: { domElement: null } as EditorDomElementSource | undefined } },
    )

    rerender({ editor: undefined })

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(1)
  })
})
