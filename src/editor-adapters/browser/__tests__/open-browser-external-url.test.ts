import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { openBrowserExternalUrl } from '../open-browser-external-url'

describe('openBrowserExternalUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens the provided external URL in a separate browser context', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)

    openBrowserExternalUrl('https://example.com/file.pdf')

    expect(openMock).toHaveBeenCalledExactlyOnceWith(
      'https://example.com/file.pdf',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('ignores external URLs outside browser contexts', () => {
    vi.stubGlobal('window', undefined)

    expect(() => openBrowserExternalUrl('https://example.com/file.pdf')).not.toThrow()
  })
})
