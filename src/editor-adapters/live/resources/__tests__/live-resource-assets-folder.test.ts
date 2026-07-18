import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import { createLiveResourceAssetsFolderGateway } from '../live-resource-assets-folder'

describe('live resource Assets folder gateway', () => {
  it('shares only concurrent resolutions and revalidates sequential requests', async () => {
    const campaignId = generateDomainId(DOMAIN_ID_KIND.campaign)
    const resourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const release: Array<() => void> = []
    const execute = vi.fn(
      () =>
        new Promise<{ status: 'completed'; resourceId: typeof resourceId }>((resolve) => {
          release.push(() => resolve({ status: 'completed', resourceId }))
        }),
    )
    const gateway = createLiveResourceAssetsFolderGateway(campaignId, execute)

    const first = gateway.ensure()
    const second = gateway.ensure()
    await Promise.resolve()

    expect(execute).toHaveBeenCalledOnce()
    release[0]!()
    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: 'completed', resourceId },
      { status: 'completed', resourceId },
    ])

    const third = gateway.ensure()
    expect(execute).toHaveBeenCalledTimes(2)
    release[1]!()
    await expect(third).resolves.toEqual({ status: 'completed', resourceId })
  })
})
