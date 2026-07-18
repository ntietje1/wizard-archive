import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { createLiveResourcePreviewSource } from '../live-resource-preview-source'

describe('createLiveResourcePreviewSource', () => {
  it('shares one bounded readonly watch and releases it with the last consumer', () => {
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const releaseWatch = vi.fn()
    let apply:
      | ((state: {
          status: 'ready'
          preview: {
            kind: 'note'
            excerpt: string
            outline: Array<{ blockId: string; level: 2; text: string }>
          }
        }) => void)
      | undefined
    const watch = vi.fn((_resourceId, publish) => {
      apply = publish
      return releaseWatch
    })
    const previews = createLiveResourcePreviewSource(watch)
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    const releaseFirst = previews.source.subscribe(resourceId, firstListener)
    const releaseSecond = previews.source.subscribe(resourceId, secondListener)
    expect(watch).toHaveBeenCalledOnce()

    apply?.({
      status: 'ready',
      preview: {
        kind: 'note',
        excerpt: 'Bounded preview',
        outline: [{ blockId, level: 2, text: 'Heading' }],
      },
    })
    expect(previews.source.get(resourceId)).toMatchObject({
      status: 'ready',
      preview: { excerpt: 'Bounded preview', outline: [{ blockId, text: 'Heading' }] },
    })
    expect(firstListener).toHaveBeenCalledOnce()
    expect(secondListener).toHaveBeenCalledOnce()

    releaseFirst()
    expect(releaseWatch).not.toHaveBeenCalled()
    releaseSecond()
    expect(releaseWatch).toHaveBeenCalledOnce()
    expect(previews.source.get(resourceId)).toEqual({ status: 'loading' })

    previews.dispose()
  })
})
