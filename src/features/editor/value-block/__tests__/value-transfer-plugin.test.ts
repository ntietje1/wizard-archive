import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { noteValueInlineConfig } from '../../../../../shared/note-values/block-config'
import { useValueTransferBehavior } from '../value-transfer-plugin'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('value transfer plugin', () => {
  it('marks value inline content as draggable editor content', () => {
    expect(noteValueInlineConfig.meta).toMatchObject({ draggable: true })
  })

  it('does not schedule a plugin registration retry after cleanup', () => {
    const requestAnimationFrameMock = vi.fn((_callback: FrameRequestCallback) => 1)
    const cancelAnimationFrameMock = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    const editor: { _tiptapEditor?: never } = {}

    const { unmount } = renderHook(() => useValueTransferBehavior(editor, true))

    expect(requestAnimationFrameMock).toHaveBeenCalledOnce()
    unmount()
    requestAnimationFrameMock.mock.calls[0][0](0)

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1)
    expect(requestAnimationFrameMock).toHaveBeenCalledOnce()
  })
})
