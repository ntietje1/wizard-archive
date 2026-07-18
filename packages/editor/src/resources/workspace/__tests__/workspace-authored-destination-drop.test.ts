import { describe, expect, it, vi } from 'vite-plus/test'
import { assertDomainId, DOMAIN_ID_KIND } from '../../domain-id'
import { createWorkspaceAuthoredDestinationDropResolver } from '../workspace-authored-destination-drop'

const RESOURCE_A = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-111111111111')
const RESOURCE_B = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-65f2-7cc0-8a3b-222222222222')

describe('workspace canvas drops', () => {
  it('resolves active workspace drags directly to bounded canonical destinations', async () => {
    const createFile = vi.fn()
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createFile },
      parentId: null,
    })
    const transfer = createDataTransfer({
      'application/x-wizard-archive-resource-ids': JSON.stringify({
        schema: 'resource-drag-v1',
        resourceIds: [RESOURCE_A, RESOURCE_B],
        lifecycle: 'active',
      }),
    })

    expect(resolver.canResolve(transfer)).toBe(true)
    await expect(resolver.resolve(transfer, 1, new AbortController().signal)).resolves.toEqual([
      {
        kind: 'internal',
        target: { kind: 'resource', resourceId: RESOURCE_A },
      },
    ])
    expect(createFile).not.toHaveBeenCalled()
  })

  it('creates dropped images through the ordinary file resource owner', async () => {
    const image = new File(['image'], 'map.png', { type: 'image/png' })
    const rejected = new File(['bad'], 'bad.bin')
    const createFile = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed', resourceId: RESOURCE_A })
      .mockResolvedValueOnce({ status: 'rejected', reason: 'unsupported' })
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createFile },
      parentId: RESOURCE_B,
    })
    const transfer = createDataTransfer({}, [image, rejected])

    expect(resolver.canResolve(transfer)).toBe(true)
    await expect(resolver.resolve(transfer, 2, new AbortController().signal)).resolves.toEqual([
      {
        kind: 'internal',
        target: { kind: 'resource', resourceId: RESOURCE_A },
      },
    ])
    expect(createFile).toHaveBeenNthCalledWith(1, RESOURCE_B, image, expect.any(AbortSignal))
    expect(createFile).toHaveBeenNthCalledWith(2, RESOURCE_B, rejected, expect.any(AbortSignal))
  })

  it('uses the same canonical file creation path for picker uploads', async () => {
    const image = new File(['image'], 'map.png', { type: 'image/png' })
    const createFile = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, resourceId: RESOURCE_A }),
    )
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createFile },
      parentId: RESOURCE_B,
    })

    await expect(resolver.resolveFiles([image], 1, new AbortController().signal)).resolves.toEqual([
      {
        kind: 'internal',
        target: { kind: 'resource', resourceId: RESOURCE_A },
      },
    ])
    expect(createFile).toHaveBeenCalledWith(RESOURCE_B, image, expect.any(AbortSignal))
  })

  it('accepts the first safe external URI without creating a resource', async () => {
    const createFile = vi.fn()
    const resolver = createWorkspaceAuthoredDestinationDropResolver({
      actions: { createFile },
      parentId: null,
    })
    const transfer = createDataTransfer({
      'text/uri-list': '# browser metadata\r\nhttps://example.com/reference\r\n',
    })

    await expect(resolver.resolve(transfer, 1, new AbortController().signal)).resolves.toEqual([
      { kind: 'externalUrl', url: 'https://example.com/reference' },
    ])
    await expect(
      resolver.resolve(
        createDataTransfer({ 'text/uri-list': 'http://example.com' }),
        1,
        new AbortController().signal,
      ),
    ).resolves.toEqual([])
    expect(createFile).not.toHaveBeenCalled()
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
