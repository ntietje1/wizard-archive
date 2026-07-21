import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { createLiveNoteOutlineSource } from '../live-note-outline-source'

describe('createLiveNoteOutlineSource', () => {
  it('shares one note outline watch and releases it with the last consumer', () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const releaseWatch = vi.fn()
    let apply:
      | ((state: {
          status: 'ready'
          headings: Array<{ blockId: string; level: 2; text: string }>
        }) => void)
      | undefined
    const watch = vi.fn((_resourceId, publish) => {
      apply = publish
      return releaseWatch
    })
    const outlines = createLiveNoteOutlineSource(watch)
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    const releaseFirst = outlines.source.subscribe(resourceId, firstListener)
    const releaseSecond = outlines.source.subscribe(resourceId, secondListener)
    expect(watch).toHaveBeenCalledOnce()

    apply?.({
      status: 'ready',
      headings: [{ blockId, level: 2, text: 'Heading' }],
    })
    expect(outlines.source.get(resourceId)).toMatchObject({
      status: 'ready',
      headings: [{ blockId, text: 'Heading' }],
    })
    expect(firstListener).toHaveBeenCalledOnce()
    expect(secondListener).toHaveBeenCalledOnce()

    releaseFirst()
    expect(releaseWatch).not.toHaveBeenCalled()
    releaseSecond()
    expect(releaseWatch).toHaveBeenCalledOnce()
    expect(outlines.source.get(resourceId)).toEqual({ status: 'loading' })

    outlines.dispose()
  })
})
