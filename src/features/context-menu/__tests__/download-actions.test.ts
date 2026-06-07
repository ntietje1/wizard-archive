import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { createDownloadActions } from '../download-actions'
import { testId } from '~/test/helpers/test-id'

const { toastDismiss, toastError, toastInfo, toastLoading, toastSuccess } = vi.hoisted(() => ({
  toastDismiss: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastLoading: vi.fn(() => 'toast-1'),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    dismiss: toastDismiss,
    error: toastError,
    info: toastInfo,
    loading: toastLoading,
    success: toastSuccess,
  },
}))

describe('createDownloadActions', () => {
  beforeEach(() => {
    toastDismiss.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
    toastLoading.mockClear()
    toastSuccess.mockClear()
    HTMLAnchorElement.prototype.click = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new Blob(['file contents']), { status: 200 }))),
    )
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:download'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('reports partial archive failures instead of presenting the export as fully successful', async () => {
    const actions = createDownloadActions({
      campaignId: testId<'campaigns'>('campaign-1'),
      convex: createConvexClient({
        items: [
          {
            type: SIDEBAR_ITEM_TYPES.files,
            downloadUrl: 'https://example.com/file.txt',
            path: 'file.txt',
          },
          {
            type: SIDEBAR_ITEM_TYPES.files,
            downloadUrl: null,
            path: 'missing.txt',
          },
        ],
      }),
    })

    await runDownloadAll(actions.downloadAll)

    expect(toastInfo).toHaveBeenCalledWith('Downloaded 1 item(s); 1 failed')
    expect(toastSuccess).not.toHaveBeenCalledWith('Downloaded 1 item(s)')
    expect(toastError).not.toHaveBeenCalledWith('Failed to download 1 item(s)')
  })

  it('reports all archive item failures as a failed download', async () => {
    const createObjectURL = vi.fn(() => 'blob:download')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
    const actions = createDownloadActions({
      campaignId: testId<'campaigns'>('campaign-1'),
      convex: createConvexClient({
        items: [
          {
            type: SIDEBAR_ITEM_TYPES.files,
            downloadUrl: null,
            path: 'missing.txt',
          },
        ],
      }),
    })

    await runDownloadAll(actions.downloadAll)

    expect(toastError).toHaveBeenCalledWith('Failed to download 1 item(s)')
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

function createConvexClient(result: { items: Array<unknown> }) {
  return {
    query: vi.fn(() => Promise.resolve(result)),
  } as never
}

async function runDownloadAll(downloadAll: unknown) {
  await (downloadAll as () => Promise<void>)()
}
