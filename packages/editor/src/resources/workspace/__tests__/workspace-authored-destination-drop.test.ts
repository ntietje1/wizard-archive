import { describe, expect, it, vi } from 'vite-plus/test'
import { assertDomainId, DOMAIN_ID_KIND } from '../../domain-id'
import type { AuthorizedResourceSummary } from '../../resource-index-contract'
import { createWorkspaceAuthoredDestinationDropResolver } from '../workspace-authored-destination-drop'

const RESOURCE_A = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-111111111111')
const RESOURCE_B = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-222222222222')

describe('workspace canvas drops', () => {
  it('resolves active workspace drags directly to bounded canonical destinations', async () => {
    const createAssetFile = vi.fn()
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createAssetFile },
      resolveResource: activeResource,
    })
    const transfer = createDataTransfer({
      'application/x-wizard-archive-resource-ids': JSON.stringify({
        schema: 'resource-drag-v2',
        resourceIds: [RESOURCE_A, RESOURCE_B],
      }),
    })

    expect(resolver.canResolve(transfer)).toBe(true)
    await expect(resolver.resolve(transfer, 1, new AbortController().signal)).resolves.toEqual({
      kind: 'destinations',
      destinations: [
        {
          kind: 'internal',
          target: { kind: 'resource', resourceId: RESOURCE_A },
        },
      ],
    })
    expect(createAssetFile).not.toHaveBeenCalled()
  })

  it('creates dropped files through the canonical Assets destination', async () => {
    const image = new File(['image'], 'map.png', { type: 'image/png' })
    const rejected = new File(['bad'], 'bad.bin')
    const createAssetFile = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed', resourceId: RESOURCE_A })
      .mockResolvedValueOnce({ status: 'rejected', reason: 'unsupported' })
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createAssetFile },
      resolveResource: () => null,
    })
    const transfer = createDataTransfer({}, [image, rejected])

    expect(resolver.canResolve(transfer)).toBe(true)
    await expect(resolver.resolve(transfer, 2, new AbortController().signal)).resolves.toEqual({
      kind: 'resourceCreations',
      settlements: [
        { status: 'completed', resourceId: RESOURCE_A },
        { status: 'rejected', reason: 'unsupported' },
      ],
    })
    expect(createAssetFile).toHaveBeenNthCalledWith(1, image, expect.any(AbortSignal))
    expect(createAssetFile).toHaveBeenNthCalledWith(2, rejected, expect.any(AbortSignal))
  })

  it('does not advertise trashed resources to authored surfaces', () => {
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createAssetFile: vi.fn() },
      resolveResource: (resourceId) => ({
        ...activeResource(resourceId as typeof RESOURCE_A),
        lifecycle: 'trashed',
      }),
    })
    const transfer = createDataTransfer({
      'application/x-wizard-archive-resource-ids': JSON.stringify({
        schema: 'resource-drag-v2',
        resourceIds: [RESOURCE_A],
      }),
    })

    expect(resolver.canResolve(transfer)).toBe(false)
  })

  it('uses the same canonical file creation path for picker uploads', async () => {
    const image = new File(['image'], 'map.png', { type: 'image/png' })
    const createAssetFile = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, resourceId: RESOURCE_A }),
    )
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createAssetFile },
      resolveResource: () => null,
    })

    await expect(resolver.resolveFiles([image], 1, new AbortController().signal)).resolves.toEqual({
      kind: 'resourceCreations',
      settlements: [{ status: 'completed', resourceId: RESOURCE_A }],
    })
    expect(createAssetFile).toHaveBeenCalledWith(image, expect.any(AbortSignal))
  })

  it('retains the transfer-owned retry until the created resource is identified', async () => {
    const image = new File(['image'], 'map.png', { type: 'image/png' })
    const retry = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, resourceId: RESOURCE_A }),
    )
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: {
        createAssetFile: vi.fn(() =>
          Promise.resolve({
            status: 'indeterminate' as const,
            reason: 'response_lost' as const,
            retry,
          }),
        ),
      },
      resolveResource: () => null,
    })

    const result = await resolver.resolveFiles([image], 1, new AbortController().signal)
    if (result.kind !== 'resourceCreations') {
      throw new Error('Expected resource creation settlements')
    }
    const creation = result.settlements[0]
    if (creation?.status !== 'indeterminate') {
      throw new Error('Expected an indeterminate creation')
    }

    await expect(creation.retry()).resolves.toEqual({
      status: 'completed',
      resourceId: RESOURCE_A,
    })
    expect(retry).toHaveBeenCalledOnce()
  })

  it('accepts the first safe external URI without creating a resource', async () => {
    const createAssetFile = vi.fn()
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createAssetFile },
      resolveResource: () => null,
    })
    const transfer = createDataTransfer({
      'text/uri-list': '# browser metadata\r\nhttps://example.com/reference\r\n',
    })

    await expect(resolver.resolve(transfer, 1, new AbortController().signal)).resolves.toEqual({
      kind: 'destinations',
      destinations: [{ kind: 'externalUrl', url: 'https://example.com/reference' }],
    })
    await expect(
      resolver.resolve(
        createDataTransfer({ 'text/uri-list': 'http://example.com' }),
        1,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ kind: 'destinations', destinations: [] })
    expect(createAssetFile).not.toHaveBeenCalled()
  })
})

function createDataTransfer(data: Record<string, string>, files: ReadonlyArray<File> = []) {
  const types = [...Object.keys(data), ...(files.length > 0 ? ['Files'] : [])]
  return {
    files,
    getData: (type: string) => data[type] ?? '',
    types,
  } as unknown as DataTransfer
}

function activeResource(resourceId: typeof RESOURCE_A): AuthorizedResourceSummary {
  return { id: resourceId, lifecycle: 'active' } as AuthorizedResourceSummary
}
