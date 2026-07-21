import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { copyNoteBlockLink } from '../block-link'

const originalClipboard = navigator.clipboard

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
  window.history.replaceState(null, '', '/')
})

describe('copyNoteBlockLink', () => {
  it('copies the canonical block target on the current campaign slug route', async () => {
    const noteId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const writeText = vi.fn<(text: string) => Promise<void>>()
    writeText.mockResolvedValue()
    const report = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    window.history.replaceState(
      null,
      '',
      '/campaigns/dm-name/campaign-slug/editor?resource=old#section',
    )

    await copyNoteBlockLink(noteId, blockId, report)

    const copied = new URL(writeText.mock.calls[0]![0])
    expect(copied.pathname).toBe('/campaigns/dm-name/campaign-slug/editor')
    expect(Object.fromEntries(copied.searchParams)).toEqual({
      resource: noteId,
      target: 'noteBlock',
      targetId: blockId,
      presentation: 'block',
    })
    expect(copied.hash).toBe('')
    expect(report).toHaveBeenCalledWith('Block link copied')
  })
})
